#!/usr/bin/env bash
set -e
npx changeset version
node scripts/sync-android-version.cjs
