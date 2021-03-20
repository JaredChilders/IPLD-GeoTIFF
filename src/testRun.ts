import { IPFS, create } from 'ipfs';

async function runTest(){
    const ipfs: IPFS = await create();
    return ipfs;
}

console.log(runTest);