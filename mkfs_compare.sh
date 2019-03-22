#!/bin/sh

PARTITION_SIZE="$((1024*1024*${1}))"
IMAGE_1="ext2.img"
IMAGE_2="outtest.img"


rm "${IMAGE_1}"
truncate -s "${PARTITION_SIZE}" "${IMAGE_1}"

mke2fs -t ext2 -r 0 -m 0 -O ^ext_attr,^resize_inode,^dir_index,^filetype,^sparse_super -U "cafecafe-cafe-cafe-cafe-cafecafecafe" "${IMAGE_1}" &
node initext2.js "${PARTITION_SIZE}" "${IMAGE_2}" &

sleep 2

hd ${IMAGE_1} > ${IMAGE_1}.txt
hd ${IMAGE_2} > ${IMAGE_2}.txt

dumpe2fs ${IMAGE_1} > ${IMAGE_1}.dumpe2fs.txt
dumpe2fs ${IMAGE_2} > ${IMAGE_2}.dumpe2fs.txt
