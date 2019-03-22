const Struct = require('struct');

// Based on https://github.com/torvalds/linux/blob/master/fs/ext2/ext2.h

const GroupDescriptor = Struct('')
	.word32Ule('bg_block_bitmap')		/* Blocks bitmap block */
	.word32Ule('bg_inode_bitmap')		/* Inodes bitmap block */
	.word32Ule('bg_inode_table')		/* Inodes table block */
	.word16Ule('bg_free_blocks_count')	/* Free blocks count */
	.word16Ule('bg_free_inodes_count')	/* Free inodes count */
	.word16Ule('bg_used_dirs_count')	/* Directories count */
	.word16Ule('bg_pad')
	.array('bg_reserved', 3, 'word32Ule');

module.exports = GroupDescriptor;

