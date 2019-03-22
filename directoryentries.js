const Struct = require('struct');

// Based on https://github.com/torvalds/linux/blob/master/fs/ext2/ext2.h

const createDirectoryEntries = (dirEntries, blockSize) => {

	if (dirEntries.length === 0) {
		throw new Error('dirEntries cannot by empty - use [[0,""]] to create empty entries')
	}

	let dirEntryStructs = dirEntries.map(de => {
		let nameFieldLength = Math.ceil(de[1].length / 4) * 4;
		// TODO check max name length
		let dir = Struct('')
			.word32Ule('inode')
			.word16Ule('rec_len')
			.word16Ule('name_len')
			.charsnt('name', nameFieldLength);
		dir.allocate();
		dir.set('inode', de[0]);
		dir.set('rec_len', dir.length());
		dir.set('name_len', de[1].length);
		dir.set('name', de[1]);

		return dir;
	});

	let size = dirEntryStructs.reduce((s, d) => s + d.length(), 0);
	dirEntryStructs[dirEntryStructs.length - 1].set('rec_len', blockSize - size + dirEntryStructs[dirEntryStructs.length - 1].length());

	return Buffer.concat(dirEntryStructs.map(d => d.buffer()));
};

module.exports = createDirectoryEntries;

