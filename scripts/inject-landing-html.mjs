import { readFile, writeFile } from 'node:fs/promises';

const code = await readFile('js/app.js', 'utf8');

const startMarker = 'view.innerHTML = `';
const startIdx = code.indexOf(startMarker, code.indexOf('function publicLanding'));
const endMarker = '`;\n  }';
const endIdx = code.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  throw new Error('Failed to locate landing template in js/app.js');
}

const landingTemplate = code.slice(startIdx + startMarker.length, endIdx);

const svgMarker = 'const heroAtmosphereSvg = () => `';
const svgStart = code.indexOf(svgMarker);
const svgEnd = code.indexOf('`;\n\nfunction initHeroParallax', svgStart);

if (svgStart === -1 || svgEnd === -1) {
  throw new Error('Failed to locate heroAtmosphereSvg in js/app.js');
}

const svgTemplate = code.slice(svgStart + svgMarker.length, svgEnd);
const renderedLanding = landingTemplate.replace('${heroAtmosphereSvg()}', svgTemplate);

let indexHtml = await readFile('index.html', 'utf8');

// Replace <main id="view" tabindex="-1"></main> with the rendered landing content
const viewRegex = /<main id="view" tabindex="-1">[\s\S]*?<\/main>/;
if (!viewRegex.test(indexHtml)) {
  throw new Error('Could not find <main id="view"> in index.html');
}

indexHtml = indexHtml.replace(viewRegex, `<main id="view" tabindex="-1">\n${renderedLanding}\n</main>`);

await writeFile('index.html', indexHtml);
console.log('Successfully injected server-rendered landing HTML into index.html');
