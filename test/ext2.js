const assert = require('assert');
const ext2 = require('../');
const fs = require('fs');
const crypto = require('crypto');
const tmp = require('tmp');

describe('ext2', function() {
	describe('#initExt2()', function() {
		it('should initialize an ext2 filesystem (test_8mb_1kb_empty.img)', function() {
			const tmpFileName = tmp.fileSync().name;
			const fd = fs.openSync(tmpFileName, 'w+');
			ext2.initExt2(fd, 1024 * 1024 * 8, 1024, {time: 1553596983});
			fs.closeSync(fd);
			const fileContent = fs.readFileSync(tmpFileName);
			const md5 = crypto.createHash('md5').update(fileContent).digest('hex');
			assert.equal(md5, '7484882dfc43285b5e9eeffdc097d283');
			fs.unlinkSync(tmpFileName);
		});
		it('should create a directory and store some small files (test_8mb_1kb_one_dir_two_files.img)', function() {
			// (need to set fixed times to prevent change of test results)
			const time = 1553596983;
			const tmpFileName = tmp.fileSync().name;
			const fd = fs.openSync(tmpFileName, 'w+');
			const f = ext2.initExt2(fd, 1024 * 1024 * 8, 1024, {time: time});
			return (async () => {
				ext2.createDirectory(f, "/brownieplayer", {uid: 1000, gid: 1000, accessRights: 0755, time: time});
				const fileOptions = {
					atime: time,
					mtime: time,
					ctime: time
				};
				await ext2.writeFileFromHostFileSystem(f, "/brownieplayer/2kb.txt", "testfiles/brownieplayer/2kb.txt", fileOptions);
				await ext2.writeFileFromHostFileSystem(f, "/brownieplayer/1kb.txt", "testfiles/brownieplayer/1kb.txt", fileOptions);
				fs.closeSync(fd);
				const fileContent = fs.readFileSync(tmpFileName);
				const md5 = crypto.createHash('md5').update(fileContent).digest('hex');
				assert.equal(md5, 'bf09a0d330d01f79bd4787aac4a4ea0d');
				fs.unlinkSync(tmpFileName);
			})();
		});
		it('should initialize an ext2 filesystem at a specified offset (test_8mb_1kb_empty_5k_offset.img)', function() {
			const tmpFileName = tmp.fileSync().name;
			const fd = fs.openSync(tmpFileName, 'w+');
			ext2.initExt2(fd, 1024 * 1024 * 8, 1024, {time: 1553596983, offset: 1024 * 5});
			fs.closeSync(fd);
			const fileContent = fs.readFileSync(tmpFileName);
			const md5 = crypto.createHash('md5').update(fileContent).digest('hex');
			assert.equal(md5, '6883d30498beb7623b18a8d0501e34ad');
			fs.unlinkSync(tmpFileName);
		});
		/*
		it('should initialize an ext2 filesystem and create a file with (> 12) data blocks that require indirect adressing (TODO)', function() {
			// TODO
		});
		it('should initialize an ext2 filesystem and create a directory whose listings use multiple blocks and indirect adressing (TODO)', function() {
			// TODO
		});
		*/
		it('should throw exception when block size is invalid', function() {
			const tmpFileName = tmp.fileSync().name;
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
			const tmpFileName = tmp.fileSync().name;
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

