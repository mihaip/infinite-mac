#!/bin/bash

set -e

# Build the lsar and uaar tools from the XADMaster
# Assumes that the https://github.com/mihaip/XADMAster and
# https://github.com/MacPaw/universal-detector submodules have been fetched.

echo "Building lsar and unar tools from XADMaster..."
ROOT_DIR="`dirname "${BASH_SOURCE[0]}"`/.."
XADMASTER_PROJECT="${ROOT_DIR}/XADMaster/XADMaster.xcodeproj"
XADMASTER_DESTINATION_DIR="${ROOT_DIR}/XADMaster-build"

mkdir -p "${XADMASTER_DESTINATION_DIR}"
XADMASTER_DESTINATION_DIR=`realpath "${XADMASTER_DESTINATION_DIR}"`
xcodebuild -scheme lsar -project "${XADMASTER_PROJECT}" -configuration Release SYMROOT="${XADMASTER_DESTINATION_DIR}"
xcodebuild -scheme unar -project "${XADMASTER_PROJECT}" -configuration Release SYMROOT="${XADMASTER_DESTINATION_DIR}"

# Build the dmg2img tool. This has no modifications so we can just use
# the upstream version.
DMG2IMG_DIR="${ROOT_DIR}/dmg2img"
DMG2IMG_REPO="https://github.com/Lekensteyn/dmg2img.git"

echo "Building dmg2img tool..."
if [ ! -d "${DMG2IMG_DIR}" ]; then
    git clone "${DMG2IMG_REPO}" "${DMG2IMG_DIR}"
fi

if [ ! -f "${DMG2IMG_DIR}/dmg2img" ]; then
    pushd "${DMG2IMG_DIR}"
    make dmg2img
    popd
fi


echo "Done!"
