#!/bin/zsh
export DEBUG="m2mgithubvalidate validate m2mspecification"
export PR_NUMBER=81
export GITHUB_TOKEN=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
npm run build
node dist/src/validate.js

