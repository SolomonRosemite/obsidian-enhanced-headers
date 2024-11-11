#!/usr/bin/env bash

source ./.env

pnpm build && \
	cp ./main.js ./manifest.json ./styles.css "$PATH_TO_PLUGIN" && \
	echo "plugin build and installed"
	
