#!/bin/bash

# Assumes that the https://github.com/mihaip/XADMAster and
# https://github.com/MacPaw/universal-detector submodules have been fetched.

ROOT_DIR="`dirname "${BASH_SOURCE[0]}"`/.."
XADMASTER_PROJECT="${ROOT_DIR}/XADMaster/XADMaster.xcodeproj"
XADMASTER_DESTINATION_DIR=`realpath "${ROOT_DIR}/XADMaster-build"`

mkdir -p "${XADMASTER_DESTINATION_DIR}"
xcodebuild -scheme lsar -project "${XADMASTER_PROJECT}" -configuration Release SYMROOT="${XADMASTER_DESTINATION_DIR}"
xcodebuild -scheme unar -project "${XADMASTER_PROJECT}" -configuration Release SYMROOT="${XADMASTER_DESTINATION_DIR}"
