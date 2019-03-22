const fs = require('fs');
const bitfield = require('./bitfield');

const superblockType = require('./types/superblock');
const groupdescriptorType = require('./types/groupdescriptor');
const inodeType = require('./types/inode');
const createDirectoryEntries = require('./directoryentries');

function allocNextFreeInode(f) {
	for (let i = 0; i < f.gds.length; i++) {
		let gd = f.gds[i];
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
	let inodeBuf = fieldsToBuffer(inodeType, inode);
	let group = Math.floor(inodeNumber / f.s.inodes_per_group);
	let index = inodeNumber % f.s.inodes_per_group;
	let offset = (f.gds[group].bg_inode_table * f.blockSize) + (index - 1) * f.s.inode_size;
	fs.writeSync(f.fd, inodeBuf, 0, f.s.inode_size, offset);
}

function readBlock(f, blockNumber) {
	let buf = Buffer.alloc(f.blockSize);
	fs.readSync(f.fd, buf, 0, f.blockSize, (blockNumber) * f.blockSize);
	return buf;
}

function fieldsToBuffer(structType, fields) {
	structType.allocate();
	for (let k in fields) {
		structType.fields[k] = fields[k];
	}
	return structType.buffer();
}

function fieldsListToBuffer(structType, fieldsList) {
	return Buffer.concat(fieldsList.map(fl => fieldsToBuffer(structType, fl)));
}

function slicesToBlockList(slices) {
	let blocks = [];
	slices.forEach(s => {
		for (let i = 0; i < s[1]; i++) {
			blocks.push(s[0] + i);
		}
	});
	return blocks;
}

function getInode(f, inodeNumber) {
	// TODO:
	// - load correct inode table block
	// - use struct to get contents
}

function getInodeByPath(f, path) {
	if (path[0] !== '/') {
		throw new Error('Path must always be absolute');
	}
	let pathList = path.split('/');
	pathList.shift();
	return getInodeByPathList(f, pathList, getInode(f, 2)); // 2: root inode
	// TODO
	// must always begin with /; no relative dirs supported
	// - recursively find inode (start at root inode == 2) :
	//   - load inode
	//   - load dir index
	//   - search for name
	//   - load inode --> return, if no path elements left
}

function getInodeByPathList(f, pathList, contextInode) {
	if (pathList.length == 0) {
		return contextInode;
	}
	// TODO
	// - check if contextInode is directory
	// - get directory listing
	// - loop dir listing and search for pathList[0] as name
	// - load corresponding inode
	// - recurse
}

function mkdir(f, path) {
	// TODO:
	// - getInodeByPath (parent inode)
	// - already exists?
	// - reserve inode
	// - write empty dir block
	// - write entry in parent inode
}

function initExt2(fd, partitionSize) {

	let time = Math.floor(Date.now() / 1000);

	// f contains all necessary structurs for the file system
	let f = {
		fd: fd,  // file descriptor
		s: {},   // superblock fields
		gds: [], // group descriptors
		blockSize: 1024
	};

	// let blockCount = Math.floor((partitionSize - 1024) / f.blockSize);
	let blockCount = Math.floor(partitionSize / f.blockSize);
	let blocksPerGroup = f.blockSize * 8;
	let blockGroups = Math.floor(1 + (blockCount - 1) / blocksPerGroup);
	let inodesPerGroup = 2048; // TODO: how to calculate it? ----> 1/32 of blocks are used as inode blocks
	let logBlockSize = 0; // 0: 1024 bytes (== 2^0 * 1024)

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
		first_data_block: 1,
		log_block_size: logBlockSize,
		log_frag_size: logBlockSize,
		blocks_per_group: blocksPerGroup,
		frags_per_group: blocksPerGroup,
		inodes_per_group: inodesPerGroup,
		wtime: time,
		max_mnt_count: -1,
		magic: 0xef53,
		state: 1, // 1: clean
		errors: 1, // 1: continue
		lastcheck: time,
		first_ino: 11,
		inode_size: 128,
		block_group_nr: 1,
		uuid:  "\xca\xfe\xca\xfe\xca\xfe\xca\xfe\xca\xfe\xca\xfe\xca\xfe\xca\xfe",
		volume_name: ""
	};

	// Write one empty block at the end of partition to ensure correct file size
	writeBlock(f, Buffer.alloc(1024, 0x00), f.s.blocks_count - 1);

	// Block groups (group descriptors)

	f.gds = [];

	for (let i = 0; i < blockGroups; i++) {
		let gd = {
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
		let bbmp = Buffer.alloc(f.blockSize, 0x00);
		bitfield.alloc(bbmp, [0, f.s.blocks_per_group - gd.bg_free_blocks_count]);
		if (idx === f.gds.length - 1) {
			// Last block group has an extra reserved block at the end - don't know why...
			gd.bg_free_blocks_count--;
			f.s.free_blocks_count--;
			bitfield.alloc(bbmp, [f.s.blocks_per_group - 1, 1]);
		}
		writeBlock(f, bbmp, gd.bg_block_bitmap);
		let ibmp = Buffer.alloc(f.blockSize, 0xff);
		bitfield.free(ibmp, [0, f.s.inodes_per_group]);
		writeBlock(f, ibmp, gd.bg_inode_bitmap);
	});
	// TODO: multiple blocks for group descriptors possible/required?

	// Reserved inodes

	// inode 1
	writeInode(
		f,
		{
			atime: time,
			ctime: time,
			mtime: time
		}, 
		allocNextFreeInode(f)
	);

	let rootBlocks = slicesToBlockList(allocNextFreeBlocks(f, 1));

	// inode 2 (root)
	let rootInodeNumber = allocNextFreeInode(f);
	let rootInode = {
		mode: 0x41ed,
		size: rootBlocks.length * f.blockSize,
		atime: time,
		ctime: time,
		mtime: time,
		links_count: 3, // TODO: - /lost+found and / itself + 1?
		blocks: f.blockSize / 512,
		block: rootBlocks
	};
	writeInode(f, rootInode, rootInodeNumber);
	f.gds[0].bg_used_dirs_count++;

	// inode 3 - 10 (other empty reserved inodes)
	for (let i = 0; i < 8; i++) {
		writeInode(f, {}, allocNextFreeInode(f));
	}

	const lostAndFoundPrereservedBlocks = 12;
	let lostAndFoundBlocks = slicesToBlockList(allocNextFreeBlocks(f, lostAndFoundPrereservedBlocks));

	// inode 11 (lost+found; not officially reserved, but always created by mke2fs)
	let lostAndFoundInodeNumber = allocNextFreeInode(f);
	let lostAndFoundInode = {
		mode: 0x41c0, // TODO: why c0 instead of ed? look up mode/flags
		size: lostAndFoundBlocks.length * f.blockSize,
		atime: time,
		ctime: time,
		mtime: time,
		links_count: 2, // TODO: ? - / and /lost+found itself?
		blocks: (f.blockSize / 512) * lostAndFoundPrereservedBlocks,
		block: lostAndFoundBlocks
	};
	writeInode(f, lostAndFoundInode, lostAndFoundInodeNumber);
	f.gds[0].bg_used_dirs_count++;

	// Directory entries for /

	let dirEntriesRoot = [
		[rootInodeNumber, '.'],
		[rootInodeNumber, '..'],
		[lostAndFoundInodeNumber, 'lost+found']
	];
	let dirEntriesRootBuffer = createDirectoryEntries(dirEntriesRoot, f.blockSize);
	writeBlock(f, dirEntriesRootBuffer, rootInode.block[0], true); // TODO: case when multiple blocks need to be written

	// Directory entries for /lost+found

	let dirEntriesLostAndFound = [
		[lostAndFoundInodeNumber, '.'],
		[rootInodeNumber, '..']
	];
	let dirEntriesLostAndFoundBuffer = createDirectoryEntries(dirEntriesLostAndFound, f.blockSize);
	writeBlock(f, dirEntriesLostAndFoundBuffer, lostAndFoundInode.block[0], true); // TODO: case when multiple blocks need to be written
	let emptyDirEntriesBuffer = createDirectoryEntries([[0,'']], f.blockSize);
	for (let i = 1; i < lostAndFoundPrereservedBlocks; i++) {
		writeBlock(f, emptyDirEntriesBuffer, lostAndFoundInode.block[i], true); // TODO: case when multiple blocks need to be written
	}

	// TODO: in block bitmap of last block group take care to mark blocks that don't exist as used; or fs should always be multiple of f.s.blocks_per_group

	// Write super block and block descriptors
	let sbBuf = fieldsToBuffer(superblockType, f.s);
	let gdsBuf = fieldsListToBuffer(groupdescriptorType, f.gds);

	f.gds.forEach((gd, idx) => {
		writeBlock(f, gdsBuf, idx * f.s.blocks_per_group + 2, true);
		writeBlock(f, sbBuf,  idx * f.s.blocks_per_group + 1);
	});

}


if (process.argv[2] == undefined) {
	throw new Error('Please specify partition size');
}

if (process.argv[3] == undefined) {
	throw new Error('Please specify output filename');
}

let fd = fs.openSync(process.argv[3], 'w+');

let partitionSize = process.argv[2];
initExt2(fd, partitionSize);

fs.closeSync(fd)

