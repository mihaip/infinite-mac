# Based on:
# https://developer.apple.com/library/archive/documentation/mac/pdf/Devices/SCSI_Manager.pdf
# https://github.com/JotaRandom/hfsutils/blob/master/libhfs/apple.h
# https://gist.github.com/erichelgeson/138ff8420917e99be57b6ce615f3400b

big_endian

requires 0 "45 52" ;# device signature

goto 0x204
set partitionCount [uint32] ;# pmMapBlkCnt in the first partition map entry
goto 0

# Block0 struct
uint16 -hex "sbSig (device signature)"
uint16 "sbBlkSize (block size of the device (in bytes)"
uint32 "sbBlkCount (# of blocks on the device)"
uint16 "sbDevType (reserved)"
uint16 "sbDevId (reserved)"
uint32 "sbData (reserved)"
uint16 "sbDrvrCount (number of driver descriptor entries)"
uint32 "ddBlock (first driver's starting block)"
uint16 "ddSize (size of the driver, in blocks)"
uint16 "ddType (driver OS type, MacOS = 1)"
bytes 486 "ddPad (additional drivers, if any)" ;# 243 uint16s

# Partition struct
for {set i 0} {$i < $partitionCount} {incr i} {
  section "Partition \[[expr {$i}]\]" {
    uint16 -hex "pmSig (partition signature - 0x504d or 0x5453)"
    uint16 "pmSigPad (reserved)"
    uint32 "pmMapBlkCnt (number of blocks in partition map)"
    uint32 "pmPyPartStart (first physical block of partition)"
    uint32 "pmPartBlkCnt (number of blocks in partition)"
    ascii 32 "pmPartName (partition name)"
    set partitionType [ascii 32 "pmParType (partition type)"]
    sectionvalue "$partitionType"
    uint32 "pmLgDataStart (first logical block of data area)"
    uint32 "pmDataCnt (number of blocks in data area)"
    uint32 "pmPartStatus (partition status information)"
    uint32 "pmLgBootStart (first logical block of boot code)"
    uint32 "pmBootSize (size of boot code, in bytes)"
    uint32 "pmBootAddr (boot code load address)"
    uint32 "pmBootAddr2 (reserved)"
    uint32 "pmBootEntry (boot code entry point)"
    uint32 "pmBootEntry2 (reserved)"
    uint32 "pmBootCksum (boot code checksum)"
    ascii 16 "pmProcessor (processor type)"
    bytes 376 "pmPad (reserved)" ;# 188 uint16s
  }
}
