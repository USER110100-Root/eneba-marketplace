import {rmSync,cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {build} from 'esbuild'
rmSync('dist',{recursive:true,force:true})
mkdirSync('dist',{recursive:true})
cpSync('public','dist',{recursive:true})
await build({entryPoints:['src/main.tsx'],bundle:true,minify:true,jsx:'automatic',external:['/assets/*'],outdir:'dist',entryNames:'app'})
const html=readFileSync('index.html','utf8').replace('</head>','<link rel="stylesheet" href="/app.css"></head>').replace('/src/main.tsx','/app.js')
writeFileSync('dist/index.html',html)
