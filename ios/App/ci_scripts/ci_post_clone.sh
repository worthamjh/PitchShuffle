#!/bin/sh
set -e
brew install node
cd "$CI_WORKSPACE"
npm install
xcodebuild -resolvePackageDependencies \
  -workspace ios/App/App.xcworkspace \
  -scheme App
