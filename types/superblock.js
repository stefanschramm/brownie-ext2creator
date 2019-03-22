const Struct = require('struct');

// Based on https://github.com/torvalds/linux/blob/master/fs/ext2/ext2.h

const Superblock = Struct('')
	.word32Ule('inodes_count')		/* Inodes count */
	.word32Ule('blocks_count')		/* Blocks count */
	.word32Ule('r_blocks_count')		/* Reserved blocks count */
	.word32Ule('free_blocks_count')	/* Free blocks count */
	.word32Ule('free_inodes_count')	/* Free inodes count */
	.word32Ule('first_data_block')	/* First Data Block */
	.word32Ule('log_block_size')		/* Block size */
	.word32Ule('log_frag_size')		/* Fragment size */
	.word32Ule('blocks_per_group')	/* # Blocks per group */
	.word32Ule('frags_per_group')		/* # Fragments per group */
	.word32Ule('inodes_per_group')	/* # Inodes per group */
	.word32Ule('mtime')			/* Mount time */
	.word32Ule('wtime')			/* Write time */
	.word16Ule('mnt_count')		/* Mount count */
	.word16Sle('max_mnt_count')		/* Maximal mount count */
	.word16Ule('magic')			/* Magic signature */
	.word16Ule('state')			/* File system state */
	.word16Ule('errors')			/* Behaviour when detecting errors */
	.word16Ule('minor_rev_level') 	/* minor revision level */
	.word32Ule('lastcheck')		/* time of last check */
	.word32Ule('checkinterval')		/* max. time between checks */
	.word32Ule('creator_os')		/* OS */
	.word32Ule('rev_level')		/* Revision level */
	.word16Ule('def_resuid')		/* Default uid for reserved blocks */
	.word16Ule('def_resgid')		/* Default gid for reserved blocks */
	.word32Ule('first_ino') 		/* First non-reserved inode */
	.word16Ule('inode_size') 		/* size of inode structure */
	.word16Ule('block_group_nr') 		/* block group # of this superblock */
	.word32Ule('feature_compat') 		/* compatible feature set */
	.word32Ule('feature_incompat') 	/* incompatible feature set */
	.word32Ule('feature_ro_compat') 	/* readonly-compatible feature set */
	.chars('uuid', 16)			/* 128-bit uuid for volume */
	.charsnt('volume_name', 16) 		/* volume name */
	.charsnt('last_mounted', 64) 		/* directory where last mounted */
	.word32Ule('algorithm_usage_bitmap') 	/* For compression */
	.word8('prealloc_blocks')		/* Nr of blocks to try to preallocate*/
	.word8('prealloc_dir_blocks')		/* Nr to preallocate for dirs */
	.word16Ule('padding1')
	.chars('journal_uuid', 16)		/* uuid of journal superblock */
	.word32Ule('journal_inum')		/* inode number of journal file */
	.word32Ule('journal_dev')		/* device number of journal file */
	.word32Ule('last_orphan')		/* start of list of inodes to delete */
	.chars('hash_seed', 4)		/* HTREE hash seed */
	.word8('def_hash_version')		/* Default hash version to use */
	.word8('reserved_char_pad')
	.word16Ule('reserved_word_pad')
	.word32Ule('default_mount_opts')
 	.word32Ule('first_meta_bg')	 	/* First metablock block group */
	.array('reserved', 193, 'word32Ule');	/* Padding to the end of the block */
	// TODO: why do we need 193 instead of 190 to get to 1024? some problem above?

module.exports = Superblock;

