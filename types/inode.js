const Struct = require('struct');

// Based on https://github.com/torvalds/linux/blob/master/fs/ext2/ext2.h

const Inode = Struct('')
	.word16Ule('mode')			/* File mode */
	.word16Ule('uid')			/* Low 16 bits of Owner Uid */
	.word32Ule('size')			/* Size in bytes */
	.word32Ule('atime')			/* Access time */
	.word32Ule('ctime')			/* Creation time */
	.word32Ule('mtime')			/* Modification time */
	.word32Ule('dtime')			/* Deletion Time */
	.word16Ule('gid')			/* Low 16 bits of Group Id */
	.word16Ule('links_count')		/* Links count */
	.word32Ule('blocks')			/* Blocks count */ // as 512 byte blocks!
	.word32Ule('flags')			/* File flags */
	.word32Ule('osd1')			/* OS dependent 1 */
	.array('block', 15, 'word32Ule')	/* Pointers to blocks */
	.word32Ule('generation')		/* File version (for NFS) */
	.word32Ule('file_acl')			/* File ACL */
	.word32Ule('dir_acl')			/* Directory ACL */
	.word32Ule('faddr')			/* Fragment address */
	.chars('osd2', 12);			/* OS dependent 2 */

module.exports = Inode;

