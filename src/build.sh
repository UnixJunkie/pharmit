#!/bin/bash

mkdir -p build
cd build

# # Some of the dependencies for Ubuntu-22.04
# sudo apt install \
#   libboost-system-dev libboost-regex1.74-dev libboost-filesystem-dev \
#   libboost-program-options-dev libboost-iostreams-dev libboost-thread-dev \
#   libopenbabel-dev libjsoncpp-dev libeigen3-dev liblemon-dev libfcgi-dev
# sudo ln -s /usr/lib/x86_64-linux-gnu/cmake/lemon/lemonConfig.cmake /usr/lib/x86_64-linux-gnu/cmake/lemon/LEMONConfig.cmake

#most likely you will have to specify the location of smina and lemon
#-DSMINA_DIR=$HOME/git/smina -DLEMON_DIR=/usr/lib/cmake/
cmake -Wno-dev -DLEMON_DIR=/usr/lib/x86_64-linux-gnu/cmake/lemon ../

NPROCS=`getconf _NPROCESSORS_ONLN`
make -$NPPROCS
