const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'apps/web/components');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(filePath));
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            results.push(filePath);
        }
    });
    return results;
}

const files = walkDir(directoryPath);
let modifiedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content
        .replace(/bg-\[#ccff00\] text-stone-950/g, 'bg-[#ccff00] text-black')
        .replace(/bg-\[#ccff00\] text-stone-900/g, 'bg-[#ccff00] text-black')
        .replace(/bg-\[#ccff00\] border-\[#ccff00\] text-stone-950/g, 'bg-[#ccff00] border-[#ccff00] text-black')
        .replace(/bg-\[#ccff00\] border-\[#ccff00\] text-stone-900/g, 'bg-[#ccff00] border-[#ccff00] text-black')
        .replace(/text-stone-950 border-\[#ccff00\]/g, 'text-black border-[#ccff00]')
        .replace(/text-stone-900 border-\[#ccff00\]/g, 'text-black border-[#ccff00]')
        .replace(/bg-\[#ccff00\] text-white/g, 'bg-[#ccff00] text-black'); // just in case
        
    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`Updated: ${file}`);
        modifiedFiles++;
    }
});

console.log(`Done. Modified ${modifiedFiles} files.`);
