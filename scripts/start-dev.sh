#!/bin/bash

ROOT_DIR="`dirname "${BASH_SOURCE[0]}"`/.."
LOCAL_CA_BUNDLE="${ROOT_DIR}/.wrangler/workerd-local-ca-bundle.pem"

export TZ=UTC

if [ -f "${LOCAL_CA_BUNDLE}" ]; then
    export NODE_EXTRA_CA_CERTS="${LOCAL_CA_BUNDLE}"
fi

exec vite
