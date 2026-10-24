#!/usr/bin/env node
// R7.9: read-only inspector for opted-in existing local benchmark JSON.
// No media access, shell execution, network traffic, or persistent output.
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {diagnoseSavedReport,formatDiagnostics}
 from './studio-export-diagnostics-core.mjs';

const HELP=[
  'ParaCut R7.9 local export report inspector (read-only)',
  'node scripts/studio-export-diagnose.mjs --input ./paracut-ab-r78.json',
  'Supports synthetic R7.8/R7.9 A/B and R7.5 scenario-lab JSON reports.',
  'Legacy aggregate-only A/B reports can be inspected but lack stage details.',
  'No video files are opened, no changes are written, and no data is uploaded.'
].join('\n');
function parse(argv){
  if(argv.includes('--help')||argv.includes('-h'))return null;
  if(argv.length!==2||argv[0]!=='--input'||
    !argv[1]||argv[1].startsWith('--'))
    throw Error('Provide exactly one --input path to a local JSON report.');
  return resolve(argv[1]);
}
async function main(){
  const path=parse(process.argv.slice(2));
  if(path===null){console.log(HELP);return;}
  const info=await stat(path);
  if(!info.isFile()||info.size<=0||info.size>512000)
    throw Error('Report must be a regular JSON file of at most 500 KiB.');
  let data;
  try{data=JSON.parse(await readFile(path,'utf8'));}
  catch{throw Error('Report is not valid UTF-8 JSON.');}
  console.log(formatDiagnostics(diagnoseSavedReport(data)));
}
main().catch(error=>{
  // No echo of user-supplied file contents, passwords or paths in errors.
  console.error('ParaCut diagnostics:',error.message);
  process.exitCode=1;
});
