#!/bin/sh
set -e
brew install node
cd "$CI_WORKSPACE"
npm install
