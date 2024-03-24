# Based on https://opensource.apple.com/source/IOStorageFamily/IOStorageFamily-44.4/IONeXTPartitionScheme.h.auto.html

big_endian

ascii 4 "dl_version (unique signature for map)"
int32 "dl_label_blkno (block on which this map resides)"
int32 "dl_size (device block count)"
ascii 24 "dl_label (device name)"
uint32 "dl_flags (device flags)"
uint32 "dl_tag (device tag)"

# Based on disktab from https://opensource.apple.com/source/xnu/xnu-344.34/bsd/sys/disktab.h.auto.html
section "dl_dt (device info, partition entries)" {
    ascii 24 d_name
    ascii 24 d_type
    int32 "d_secsize (sector size in bytes)"
	int32 "d_ntracks (# tracks/cylinder)"
	int32 "d_nsectors (# sectors/track)"
	int32 "d_ncylinders (# cylinders)"
	int32 "d_rpm (revolutions/minute)"
	int16 "d_front (size of front porch (sectors))"
	int16 "d_back (size of back porch (sectors))"
	int16 "d_ngroups (number of alt groups)"
	int16 "d_ag_size (alt group size (sectors))"
	int16 "d_ag_alts (alternate sectors / alt group)"
	int16 "d_ag_off (sector offset to first alternate)"
    int32 "d_boot0_blkno\[0\] ('blk 0' boot locations)"
    int32 "d_boot0_blkno\[1\] ('blk 0' boot locations)"
    ascii 24 "d_bootfile (default bootfile)"
    ascii 32 "d_hostname (host name)"
    ascii 1 "d_rootpartition (root partition e.g. 'a')"
    ascii 1 "d_rwpartition (root partition e.g. 'b')"

    for {set i 0} {$i < 8} {incr i} {
        section "d_partitions\[[expr {$i}]\]" {
            int32 "p_base (base sector# of partition)"
            int32 "p_size (#sectors in partition)"
            int16 "p_bsize (block size in bytes)"
            int16 "p_fsize (frag size in bytes)"
            ascii 1 "p_opt ('s'pace/'t'ime optimization pref)"
            # Padding
            uint8
            int16 "p_cpg (cylinders per group)"
            int16 "p_density (bytes per inode density)"
            uint8 "p_minfree (minfree %)"
            uint8 "p_newfs (run newfs during init)"
            ascii 16 "p_mountpt (mount point)"
            uint8 "p_automnt (auto-mount when inserted)"
            ascii 8 "p_type (file system type)"
            # Padding
            uint8
        }
    }
}
