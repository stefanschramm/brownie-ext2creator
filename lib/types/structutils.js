
function fieldsToBuffer(structType, fields) {
	structType.allocate();
	for (let k in fields) {
		structType.fields[k] = fields[k];
	}
	return structType.buffer();
}

function bufferToFields(structType, buf, specialFieldFunction = {}) {
	structType._setBuff(buf);
	let fields = {};
	Object.keys(structType.fields).forEach(k => {
		let v = structType.get(k);
		if (specialFieldFunction[k] != undefined) {
			fields[k] = specialFieldFunction[k](v);
		}
		else {
			fields[k] = v;
		}
	});
	return fields;
}

function fieldsListToBuffer(structType, fieldsList) {
	return Buffer.concat(fieldsList.map(fl => fieldsToBuffer(structType, fl)));
}

module.exports = {
	fieldsToBuffer: fieldsToBuffer,
	fieldsListToBuffer: fieldsListToBuffer,
	bufferToFields: bufferToFields
}
