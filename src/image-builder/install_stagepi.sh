#!/bin/bash
ROOTFS_DIR=./rootfs

mount_chroot() {
        echo "Mounting chroot filesystems..."
        if ! mount | grep -q "$(realpath "${ROOTFS_DIR}"/proc)"; then
                mount -t proc proc "${ROOTFS_DIR}/proc"
        fi

        if ! mount | grep -q "$(realpath "${ROOTFS_DIR}"/dev)"; then
                mount --bind /dev "${ROOTFS_DIR}/dev"
        fi

        if ! mount | grep -q "$(realpath "${ROOTFS_DIR}"/dev/pts)"; then
                mount --bind /dev/pts "${ROOTFS_DIR}/dev/pts"
        fi

        if ! mount | grep -q "$(realpath "${ROOTFS_DIR}"/sys)"; then
                mount --bind /sys "${ROOTFS_DIR}/sys"
        fi

        if ! mount | grep -q "$(realpath "${ROOTFS_DIR}"/run)"; then
                mount -t tmpfs  tmpfs "${ROOTFS_DIR}/run"
        fi

        if ! mount | grep -q "$(realpath "${ROOTFS_DIR}"/tmp)"; then
                mount -t tmpfs  tmpfs "${ROOTFS_DIR}/tmp"
        fi

        #capsh $CAPSH_ARG "--chroot=${ROOTFS_DIR}/" -- -e "$@"
}

unmount_chroot() {
    echo "Unmounting chroot filesystems..."
    # Unmount nested mounts first
    umount "${ROOTFS_DIR}/dev/pts"
    umount "${ROOTFS_DIR}/dev"
    umount "${ROOTFS_DIR}/proc"
    umount "${ROOTFS_DIR}/sys"
    umount "${ROOTFS_DIR}/run"
    umount "${ROOTFS_DIR}/tmp"
}
unmount_chroot
mount_chroot
# install the latest package
cp ../../../../build/stagepi-latest.deb "${ROOTFS_DIR}/root/"
chroot "${ROOTFS_DIR}" /bin/bash -c "apt install --upgrade /root/stagepi-latest.deb"
rm "${ROOTFS_DIR}/root/stagepi-latest.deb"
# clean up
chroot "${ROOTFS_DIR}" /bin/bash -c "apt clean"
chroot "${ROOTFS_DIR}" /bin/bash -c "apt autoremove -y"
chroot "${ROOTFS_DIR}" /bin/bash -c "history -c"
unmount_chroot
