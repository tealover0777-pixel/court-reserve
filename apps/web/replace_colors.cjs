const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.css')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./components').concat(walk('./app'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;

    if (file.endsWith('.tsx')) {
        // Replace text-[#4f6b28] with text-[#d97706]
        content = content.replace(/text-\[#4f6b28\]/g, 'text-[#d97706]');
        
        // Find lines with bg-[#4f6b28] and replace text-white with text-stone-950
        let lines = content.split('\n');
        lines = lines.map(line => {
            if (line.includes('bg-[#4f6b28]')) {
                line = line.replace(/text-white/g, 'text-stone-950');
            }
            return line;
        });
        content = lines.join('\n');

        // Replace other #4f6b28 occurrences with #fbbf24 (bg, border, ring, shadow)
        content = content.replace(/bg-\[#4f6b28\]/g, 'bg-[#fbbf24]');
        content = content.replace(/border-\[#4f6b28\]/g, 'border-[#fbbf24]');
        content = content.replace(/ring-\[#4f6b28\]/g, 'ring-[#fbbf24]');
        content = content.replace(/shadow-\[#4f6b28\]/g, 'shadow-[#fbbf24]');

        // Replace #ccff00 with #fcd34d
        content = content.replace(/#ccff00/g, '#fcd34d');
    }

    if (file.endsWith('globals.css')) {
        // Update Light Theme primary
        content = content.replace(/--primary: #556d00;/g, '--primary: #fbbf24;');
        // The first --on-primary: #ffffff; under Light Theme (before Dark Theme)
        content = content.replace(/--on-primary: #ffffff;/, '--on-primary: #0c0a09;');
        
        // Update Dark Theme primary (Vantage Noir)
        content = content.replace(/--primary: #81ecff;/g, '--primary: #fcd34d;');
        content = content.replace(/--on-primary: #005762;/, '--on-primary: #0c0a09;');
    }

    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
