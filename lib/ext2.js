const fs = require('fs');
const bitfield = require('./bitfield');

const superblockType = require('./types/superblock');
const groupdescriptorType = require('./types/groupdescriptor');
const inodeType = require('./types/inode');
const directoryEntries = require('./directoryentries');

const modes = {
	// file format
	S_IFREG: 0x8000, // regular file
	S_IFDIR: 0x4000, // directory
	// access rights
	S_IRUSR: 0x0100, // user read
	S_IWUSR: 0x0080, // user write
	S_IXUSR: 0x0040, // user execute
	S_IRGRP: 0x0020, // group read
	S_IWGRP: 0x0010, // group write
	S_IXGRP: 0x0008, // group execute
	S_IROTH: 0x0004, // others read
	S_IWOTH: 0x0002, // others write
	S_IXOTH: 0x0001  // others execute
	// (other flags not listed since not supported)
};

const rootInodeNumber = 2;

function allocNextFreeInode(f) {
	for (let i = 0; i < f.gds.length; i++) {
		const gd = f.gds[i];
		if (gd.bg_free_inodes_count > 0) {
			let ibmp = readBlock(f, gd.bg_inode_bitmap);
			let offset = bitfield.getFree(ibmp);
			bitfield.alloc(ibmp, [offset, 1]);
			writeBlock(f, ibmp, gd.bg_inode_bitmap);
			gd.bg_free_inodes_count--;
			f.s.free_inodes_count--;

			return i * f.s.inodes_per_group + offset + 1;
		}
	};
}

function allocNextFreeBlocks(f, count) {
	// TODO: probably doesn't work yet across group boundaries
	// TODO: check if real slicing works
	let slices = [];
	let allocated = 0;
	for (let i = 0; i < f.gds.length; i++) {
		let gd = f.gds[i];
		if (gd.bg_free_blocks_count > 0) {
			let bbmp = readBlock(f, gd.bg_block_bitmap);
			let curSlices = bitfield.getFreeSlices(bbmp, count - allocated);
			curSlices = curSlices.map(s => [i * f.s.blocks_per_group + s[0], s[1]]);
			let curAllocated = curSlices.reduce((sum, slice) => sum + slice[1], 0)
			slices = slices.concat(curSlices);
			allocated += curAllocated;

			bitfield.allocSlices(bbmp, curSlices);
			writeBlock(f, bbmp, gd.bg_block_bitmap);

			gd.bg_free_blocks_count -= curAllocated;
			f.s.free_blocks_count -= curAllocated;

			if (allocated >= count) {
				return slices.map(s => [s[0] + 1, s[1]]);
			}
		}
	};

	throw new Error("Unable to allocate requested number of blocks");
}

function writeBlock(f, buffer, blockNumber, pad = false, padding = 0x00) {
	fs.writeSync(f.fd, buffer, 0, buffer.length, blockNumber * f.blockSize);
	if (buffer.length > f.blockSize) {
		throw new Error("Buffer too long");
	}
	if (buffer.length < f.blockSize) {
		if (!pad) {
			throw new Error("Buffer not padded to block size and padding not requested");
		}
		let remaining = f.blockSize - buffer.length;
		fs.writeSync(f.fd, Buffer.alloc(remaining, padding), 0, remaining, blockNumber * f.blockSize + buffer.length);
	}
}

function writeInode(f, inode, inodeNumber) {
	let inodeBuf = inodeType.fieldsToBuffer(inode);
	let group = getGroupOfInode(f, inodeNumber);
	let index = inodeNumber % f.s.inodes_per_group;
	let offset = (f.gds[group].bg_inode_table * f.blockSize) + (index - 1) * f.s.inode_size;
	fs.writeSync(f.fd, inodeBuf, 0, f.s.inode_size, offset);
}

function getGroupOfInode(f, inodeNumber) {
	return Math.floor(inodeNumber / f.s.inodes_per_group);
}

function readBlock(f, blockNumber) {
	let buf = Buffer.alloc(f.blockSize);
	fs.readSync(f.fd, buf, 0, f.blockSize, (blockNumber) * f.blockSize);
	return buf;
}

function slicesToBlockList(slices) {
	const blocks = [];
	slices.forEach(s => {
		for (let i = 0; i < s[1]; i++) {
			blocks.push(s[0] + i);
		}
	});
	return blocks;
}

function getInode(f, inodeNumber) {
	let group = getGroupOfInode(f, inodeNumber);
	let index = inodeNumber % f.s.inodes_per_group;
	let offset = (f.gds[group].bg_inode_table * f.blockSize) + (index - 1) * f.s.inode_size;
	let buf = Buffer.alloc(f.s.inode_size);
	fs.readSync(f.fd, buf, 0, f.s.inode_size, offset);
	return inodeType.bufferToFields(buf);
}

function getInodeNumberByPathList(f, pathList, contextInodeNumber = null) {
	if (contextInodeNumber === null) {
		contextInodeNumber = 2; // 2: root inode number
	}
	if (pathList.length == 0) {
		return contextInodeNumber;
	}
	let contextInode = getInode(f, contextInodeNumber);
	if (! isDir(contextInode)) {
		throw new Error('No directory');
	}
	let entries = loadDirectory(f, contextInode);
	for (let i = 0; i < entries.length; i++) {
		let entry = entries[i];
		if (entry[1] === pathList[0]) {
			pathList.shift();
			return getInodeNumberByPathList(f, pathList, entry[0]);
		}

	}

	// File doesn't exist
	return false;
}

function analyzeCreatePath(f, path) {
	if (path[0] !== '/') {
		throw new Error('Only absoulte paths are supported');
	}
	let pathList = path.split('/');
	pathList.shift();
	
	let fileName = pathList.pop();

	if (fileName.length === 0) {
		throw new Error("Filename can't be empty");
	}

	if (fileName.indexOf(0x00) !== -1) {
		throw new Error('Character 0x00 not allowed in filenames');
	}

	let parentInodeNumber = getInodeNumberByPathList(f, pathList);
	if (parentInodeNumber === false) {
		throw new Error('Parent directory not found');
	}

	if (getInodeNumberByPathList(f, [fileName], parentInodeNumber) !== false) {
		throw new Error('File already exists');
	}

	let parentInode = getInode(f, parentInodeNumber);
	if (! isDir(parentInode)) {
		throw new Error('Parent is no directory');
	}

	return {
		parentInodeNumber: parentInodeNumber,
		parentInode: parentInode,
		fileName: fileName
	}
}

function writeFileFromBuffer(f, path, buffer, options = {}) {
	// TODO: check sb if there are enough free blocks in file system
	const slices = createFileInodeAndGetDataSlices(f, path, buffer.length, options);

	let written = 0;
	slices.forEach(s => {
		fs.writeSync(f.fd, buffer, written, Math.min(s[1] * f.blockSize, buffer.length - written), s[0] * f.blockSize);
		written += s[1];
	});
}

async function writeFileFromHostFileSystem(f, destinationPath, sourcePath, options = {}) {
	const stats = fs.statSync(sourcePath);

	if (options.accessRights === undefined) {
		options.accessRights = stats.mode & 0xfff;
	}
	if (options.uid === undefined) {
		options.uid = stats.uid;
	}
	if (options.gid === undefined) {
		options.gid = stats.gid;
	}
	if (options.atime === undefined) {
		options.atime = Math.floor(stats.atimeMs / 1000);
	}
	if (options.mtime === undefined) {
		options.mtime = Math.floor(stats.mtimeMs / 1000);
	}
	if (options.ctime === undefined) {
		options.ctime = Math.floor(stats.ctimeMs / 1000);
	}

	// TODO: check sb if there are enough free blocks in file system in advance
	let slices = createFileInodeAndGetDataSlices(f, destinationPath, stats.size, options);

	let written = 0;
	for (let i = 0; i < slices.length; i++) {
		const s = slices[i];
		const readStream = fs.createReadStream(sourcePath, {start: written, end: written + s[1] * f.blockSize - 1}); // TODO: -1 correct?
		const writeStream = fs.createWriteStream(null, {fd: f.fd, start: s[0] * f.blockSize, autoClose: false});
		await new Promise(fulfill => readStream.pipe(writeStream).on("finish", fulfill));
		written += s[1];
	}
}

function writeUpdatedMetaData(f) {
	// Write super block and block descriptors
	const sbBuf = superblockType.fieldsToBuffer(f.s);
	const gdsBuf = groupdescriptorType.fieldsListToBuffer(f.gds);

	f.gds.forEach((gd, idx) => {
		writeBlock(f, gdsBuf, idx * f.s.blocks_per_group + 2, true);
		writeBlock(f, sbBuf,  idx * f.s.blocks_per_group + 1, true);
	});
}

function createFileInodeAndGetDataSlices(f, path, size, options) {

	if (options.accessRights === undefined) {
		options.accessRights = modes.S_IRUSR | modes.S_IXUSR | modes.S_IRGRP | modes.S_IXGRP | modes.S_IROTH | modes.S_IXOTH;
	}
	options.accessRights &= modes.S_IRUSR | modes.S_IWUSR | modes.S_IXUSR | modes.S_IRGRP | modes.S_IWGRP | modes.S_IXGRP | modes.S_IROTH | modes.S_IWOTH | modes.S_IXOTH;

	if (options.gid === undefined) {
		options.gid = 0;
	}

	if (options.uid === undefined) {
		options.uid = 0;
	}

	let time = Math.floor(Date.now() / 1000);
	['atime', 'ctime', 'mtime'].forEach(k => {
		if (options[k] === undefined) {
			options[k] = time;
		}
	});

	const createPath = analyzeCreatePath(f, path);

	// TODO:
	// - indirect adressing stuff...
	// - determine number of indirect adressing blocks
	// - allocate adressing blocks first
	const slices = allocNextFreeBlocks(f, Math.ceil(size / f.blockSize));
	const blocks = slices.reduce((sum, s) => sum + s[1], 0);
	const inodeNumber = allocNextFreeInode(f);
	const inode = {
		mode: modes.S_IFREG | options.accessRights,
		uid: options.uid,
		size: size,
		atime: options.atime,
		ctime: options.ctime,
		mtime: options.mtime,
		gid: options.gid,
		links_count: 1,
		blocks: (blocks * f.blockSize) / 512,
		block: slicesToBlockList(slices)
	};

	const parentDirectory = loadDirectory(f, createPath.parentInode);
	parentDirectory.push([inodeNumber, createPath.fileName]);
	const parentDirectoryBuffer = directoryEntries.create(parentDirectory, f.blockSize);
	writeBlock(f, parentDirectoryBuffer, createPath.parentInode.block[0], true);
	writeInode(f, inode, inodeNumber);

	// Refresh superblock and group descriptors
	writeUpdatedMetaData(f);

	return slices;
}

function createDirectory(f, path, options = {}) {

	if (options.accessRights === undefined) {
		options.accessRights = modes.S_IRUSR | modes.S_IXUSR | modes.S_IRGRP | modes.S_IXGRP | modes.S_IROTH | modes.S_IXOTH;
	}
	options.accessRights &= modes.S_IRUSR | modes.S_IWUSR | modes.S_IXUSR | modes.S_IRGRP | modes.S_IWGRP | modes.S_IXGRP | modes.S_IROTH | modes.S_IWOTH | modes.S_IXOTH;

	if (options.uid === undefined) {
		options.uid = 0;
	}

	if (options.gid === undefined) {
		options.gid = 0;
	}

	if (options.time === undefined) {
		options.time = Math.floor(Date.now() / 1000);
	}

	if (options.prereservedDirectoryBlocks === undefined) {
		options.prereservedDirectoryBlocks = 1;
	}

	const createPath = analyzeCreatePath(f, path);
	const slices = allocNextFreeBlocks(f, options.prereservedDirectoryBlocks);
	const blocks = slices.reduce((sum, s) => sum + s[1], 0);
	const inodeNumber = allocNextFreeInode(f);
	const blockList = slicesToBlockList(slices);
	const inode = {
		mode: modes.S_IFDIR | options.accessRights,
		uid: options.uid,
		size: blocks * f.blockSize,
		atime: options.time,
		ctime: options.time,
		mtime: options.time,
		gid: options.gid,
		links_count: 2, // (parent and itself)
		blocks: (blocks * f.blockSize) / 512,
		block: blockList
	};

	// Write entry in parent directory
	const parentDirectory = loadDirectory(f, createPath.parentInode);
	parentDirectory.push([inodeNumber, createPath.fileName]);
	const parentDirectoryBuffer = directoryEntries.create(parentDirectory, f.blockSize);
	writeBlock(f, parentDirectoryBuffer, createPath.parentInode.block[0], true);

	writeInode(f, inode, inodeNumber);

	// Increment link count in parent inode
	createPath.parentInode.links_count++;
	writeInode(f, createPath.parentInode, createPath.parentInodeNumber);

	// Increment link count in group descriptor
	const group = getGroupOfInode(f, inodeNumber);
	f.gds[group].bg_used_dirs_count++;
	// (gets written at the very end)

	// Create new empty directory listing
	const dirEntriesNew = [
		[inodeNumber, '.'],
		[createPath.parentInodeNumber, '..'],
	];
	const dirEntriesNewBuffer = directoryEntries.create(dirEntriesNew, f.blockSize);
	writeBlock(f, dirEntriesNewBuffer, inode.block[0], true); // TODO: case when multiple blocks need to be written??
	
	// (Remaining) prereserved blocks
	const emptyDirEntriesBuffer = directoryEntries.create([[0,'']], f.blockSize);
	for (let i = 1; i < options.prereservedDirectoryBlocks; i++) {
		writeBlock(f, emptyDirEntriesBuffer, blockList[i], true); // TODO: case when multiple blocks need to be written
	}
}

function isDir(inode) {
	return (inode.mode & modes.S_IFDIR) !== 0;
}

function loadDirectory(f, inode) {
	const buf = readBlock(f, inode.block[0]);
	// TODO: multiple blocks?
	const entries = directoryEntries.readEntriesFromBuffer(f, buf);
	return entries;
}

function initExt2(fd, partitionSize, blockSize = 1024, options = {}) {

	if (options.time === undefined) {
		options.time = Math.floor(Date.now() / 1000);
	}
	if (options.uuid === undefined) {
		options.uuid = "\xca\xfe\xca\xfe\xca\xfe\xca\xfe\xca\xfe\xca\xfe\xca\xfe\xca\xfe";
	}
	if (options.volumeName === undefined) {
		options.volumeName = '';
	}

	const allowedBlockSizes = [1024, 2048, 4096, 8192];

	const logBlockSize = allowedBlockSizes.indexOf(blockSize); // 0: 1024 bytes (== 2^0 * 1024)
	if (logBlockSize < 0) {
		throw new Error("Illegal block size");
	}

	if (partitionSize % blockSize != 0) {
		throw new Error("Partition size must be multiple of block size");
	}

	// f contains all necessary structures for the file system
	const f = {
		fd: fd,  // file descriptor
		s: {},   // superblock fields
		gds: [], // group descriptors
		blockSize: blockSize
	};

	// let blockCount = Math.floor((partitionSize - 1024) / f.blockSize);
	const blockCount = Math.floor(partitionSize / f.blockSize);
	const blocksPerGroup = f.blockSize * 8;
	const blockGroups = Math.floor(1 + (blockCount - 1) / blocksPerGroup);
	const inodesPerGroup = 2048; // TODO: how to calculate it? ----> 1/32 of blocks are used as inode blocks

	// TODO: minimum size of blockGroups (must contain at least 5 blocks to store at least inode table?)

	// Superblock

	const initiallyUsedBlocksPerBlockGroup = 4 + inodesPerGroup * inodeType.length() / f.blockSize;

	// Subtract from initial free space of each block group:
	// - superblock
	// - groupdescriptor block(s) TODO: multiple possible
	// - block bitmap block
	// - inode bitmap block
	// - N x inode table block

	f.s = {
		blocks_count: blockCount,
		inodes_count: inodesPerGroup * blockGroups,
		free_blocks_count: blockCount - blockGroups * initiallyUsedBlocksPerBlockGroup,
		free_inodes_count: inodesPerGroup * blockGroups,
		first_data_block: 1, // TODO: changes when bs > 1024
		log_block_size: logBlockSize,
		log_frag_size: logBlockSize,
		blocks_per_group: blocksPerGroup,
		frags_per_group: blocksPerGroup,
		inodes_per_group: inodesPerGroup,
		wtime: options.time,
		max_mnt_count: -1,
		magic: 0xef53,
		state: 1, // 1: clean
		errors: 1, // 1: continue
		lastcheck: options.time,
		first_ino: 11,
		inode_size: inodeType.length(),
		block_group_nr: 1, // TODO: dynamic when bs > 1024
		uuid:  options.uuid,
		volume_name: options.volumeName
	};

	// Write one empty block at the end of partition to ensure correct file size
	writeBlock(f, Buffer.alloc(f.blockSize, 0x00), f.s.blocks_count - 1);

	// Block groups (group descriptors)

	f.gds = [];

	for (let i = 0; i < blockGroups; i++) {
		const gd = {
			bg_block_bitmap: i * f.s.blocks_per_group + 3,
			bg_inode_bitmap: i * f.s.blocks_per_group + 4,
			bg_inode_table: i * f.s.blocks_per_group + 5,
			bg_free_blocks_count: f.s.blocks_per_group - initiallyUsedBlocksPerBlockGroup,
			bg_free_inodes_count: f.s.inodes_per_group,
			bg_used_dirs_count: 0,
			bg_pad: 4
		};
		f.gds.push(gd);
	}

	// Block and inode bitmaps

	f.gds.forEach((gd, idx) => {
		const bbmp = Buffer.alloc(f.blockSize, 0x00);
		bitfield.alloc(bbmp, [0, f.s.blocks_per_group - gd.bg_free_blocks_count]);
		if (idx === f.gds.length - 1) {
			// Last block group has an extra reserved block at the end - don't know why...
			gd.bg_free_blocks_count--;
			f.s.free_blocks_count--;
			bitfield.alloc(bbmp, [f.s.blocks_per_group - 1, 1]);
		}
		writeBlock(f, bbmp, gd.bg_block_bitmap);
		const ibmp = Buffer.alloc(f.blockSize, 0x00);
		bitfield.alloc(ibmp, [f.s.inodes_per_group, Math.floor((f.blockSize / f.s.inode_size) * f.s.inodes_per_group) - f.s.inodes_per_group]);
		writeBlock(f, ibmp, gd.bg_inode_bitmap);
	});
	// TODO: multiple blocks for group descriptors possible/required?

	// Reserved inodes

	// inode 1
	writeInode(
		f,
		{
			atime: options.time,
			ctime: options.time,
			mtime: options.time
		}, 
		allocNextFreeInode(f)
	);

	const rootBlocks = slicesToBlockList(allocNextFreeBlocks(f, 1));

	// inode 2 (root)
	const allocatedRootInodeNumber = allocNextFreeInode(f);
	if (allocatedRootInodeNumber !== rootInodeNumber) {
		throw new Error('Unexpected allocated inode number for / ');
	}
	const rootInode = {
		mode: 0x41ed,
		size: rootBlocks.length * f.blockSize,
		atime: options.time,
		ctime: options.time,
		mtime: options.time,
		links_count: 2, // (. and .. point both at itself)
		blocks: f.blockSize / 512,
		block: rootBlocks
	};
	writeInode(f, rootInode, rootInodeNumber);
	f.gds[0].bg_used_dirs_count++;

	// inode 3 - 10 (other empty reserved inodes)
	for (let i = 0; i < 8; i++) {
		writeInode(f, {}, allocNextFreeInode(f));
	}

	// Directory entries for /

	const dirEntriesRoot = [
		[rootInodeNumber, '.'],
		[rootInodeNumber, '..'],
	];
	const dirEntriesRootBuffer = directoryEntries.create(dirEntriesRoot, f.blockSize);
	writeBlock(f, dirEntriesRootBuffer, rootInode.block[0], true); // TODO: case when multiple blocks need to be written

	// Use create directory function for /lost+found
	createDirectory(f, '/lost+found', {prereservedDirectoryBlocks: 12, accessRights: 0700});

	// TODO: in block bitmap of last block group take care to mark blocks that don't exist as used; or fs should always be multiple of f.s.blocks_per_group

	// Write super block and block descriptors
	writeUpdatedMetaData(f);

	// TODO: even when blockSize > 1024, the sb should be written at 0x400 and the block numbers seem to start at 0 instead of 1 (first_data_block)

	return f;
}

module.exports = {
	initExt2: initExt2,
	createDirectory: createDirectory,
	writeFileFromHostFileSystem: writeFileFromHostFileSystem,
	modes: modes
};

