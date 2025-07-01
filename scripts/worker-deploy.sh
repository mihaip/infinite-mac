#!/bin/bash

tsc --noEmit && \
    tsc --noEmit --project worker/tsconfig.json && \
    CLOUDFLARE_ENV=production vite build && \
    wrangler deploy
