#!/bin/sh
set -ex

WORKSPACE=/Volumes/workspace/repository

brew install node
cd $WORKSPACE
npm install

cd $WORKSPACE/ios/App/CapApp-SPM
swift package resolve

mkdir -p $WORKSPACE/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
cp Package.resolved $WORKSPACE/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved