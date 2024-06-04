#!/bin/zsh
export DEBUG="m2mgithubvalidate validate m2mspecification"
export PR_NUMBER=74
export GITHUB_TOKEN=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
npm run build
node dist/src/validate.js

