const assert = require('assert');
const ext2 = require('../');
const fs = require('fs');
const crypto = require('crypto');

const tmpFileName = 'tmp/test.img';

describe('ext2', function() {
	describe('#initExt2()', function() {
		it('should initialize an ext2 filesystem (test_8mb_1kb_empty.img)', function() {
			const fd = fs.openSync(tmpFileName, 'w+');
			ext2.initExt2(fd, 1024 * 1024 * 8, 1024, {time: 1553596983});
			fs.closeSync(fd);
			const fileContent = fs.readFileSync(tmpFileName);
			const md5 = crypto.createHash('md5').update(fileContent).digest('hex');
			assert.equal(md5, '7484882dfc43285b5e9eeffdc097d283');
			fs.unlinkSync(tmpFileName);
		});
		it('should initialize an ext2 filesystem, create a directory and store some small files in it', function() {
			const fd = fs.openSync(tmpFileName, 'w+');
			const f = ext2.initExt2(fd, 1024 * 1024 * 8, 1024, {time: 1553596983});
			(async () => {
				ext2.createDirectory(f, "/brownieplayer", {uid: 1000, gid: 1000, accessRights: 0755});
				await ext2.writeFileFromHostFileSystem(f, "/brownieplayer/test1.txt", "testfiles/brownieplayer/test1.txt");
				await ext2.writeFileFromHostFileSystem(f, "/brownieplayer/test2.txt", "testfiles/brownieplayer/test2.txt");
				fs.closeSync(fd);
				assert.equal(1, 1); // TODO
				fs.unlinkSync(tmpFileName);
			});
		});
		it('should throw exception when block size is invalid', function() {
			const tmpFileName = 'tmp/test.img';
			let fd = fs.openSync(tmpFileName, 'w+');
			try {
				ext2.initExt2(fd, 1024 * 1024 * 8, 1234);
			}
			catch (e) {
				assert.equal(e.message, 'Illegal block size');
			}
			fs.closeSync(fd);
			fs.unlinkSync(tmpFileName);
		});
		it('should throw exception when partition size is not multiple of block size', function() {
			const tmpFileName = 'tmp/test.img';
			let fd = fs.openSync(tmpFileName, 'w+');
			try {
				ext2.initExt2(fd, 1234 * 1234 * 8, 1024);
			}
			catch (e) {
				assert.equal(e.message, 'Partition size must be multiple of block size');
			}
			fs.closeSync(fd);
			fs.unlinkSync(tmpFileName);
		});
	});
});

