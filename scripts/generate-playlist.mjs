#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config', 'sources.json');
const OUTPUT_DIR = join(__dirname, '..', 'output');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load configuration
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

// Parse M3U content and extract channel info
function parseM3U(content, sourceName = 'Unknown') {
  const channels = [];
  const lines = content.split('\n');
  
  let currentChannel = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and comments (except EXTINF)
    if (!line || line.startsWith('#') && !line.startsWith('#EXTINF:')) continue;
    
    if (line.startsWith('#EXTINF:')) {
      // Parse EXTINF line
      const match = line.match(/#EXTINF:(-?\d+)\s+([^?]*)(\?[^#]*)?(?:#EXTVLCOPT:[^=]*=[^\n]*)*\s*([^\n]*)/);
      if (match) {
        const duration = match[1];
        let attributes = {};
        const attrPart = match[2] || '';
        
        // Extract group-title
        const groupMatch = attrPart.match(/group-title="([^"]*)"/);
        attributes.groupTitle = groupMatch ? groupMatch[1] : 'Unknown';
        
        // Extract tvg-name
        const nameMatch = attrPart.match(/tvg-name="([^"]*)"/);
        attributes.tvgName = nameMatch ? nameMatch[1] : '';
        
        // Extract tvg-logo
        const logoMatch = attrPart.match(/tvg-logo="([^"]*)"/);
        attributes.tvgLogo = logoMatch ? logoMatch[1] : '';
        
        // Extract channel name (after attributes)
        const namePart = attrPart.split(',').pop() || '';
        attributes.tvgName = attributes.tvgName || namePart.trim();
        if (!attributes.groupTitle) attributes.groupTitle = 'Unknown';
        
        currentChannel = attributes;
      }
    } else if (line && line.match(/^https?:\/\//)) {
      // This is a URL line
      if (currentChannel) {
        currentChannel.url = line;
        currentChannel.source = sourceName;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }
  }
  
  return channels;
}

// Fetch channel info from GitHub raw URL
async function fetchSources() {
  const allChannels = [];
  const fetchedSources = [];
  
  for (const [sourceId, source] of Object.entries(config.sources)) {
    if (!source.enabled) continue;
    
    console.log(`Fetching ${sourceId}...`);
    
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': config.verification.userAgent,
          'Accept': 'text/plain,application/json,*/*'
        },
        timeout: config.verification.timeout
      });
      
      if (!response.ok) {
        console.error(`  Failed to fetch ${source.url}: ${response.status}`);
        continue;
      }
      
      const content = await response.text();
      
      if (source.type === 'static' && content.includes('#EXTM3U')) {
        const channels = parseM3U(content, source.description || sourceId);
        allChannels.push(...channels);
        fetchedSources.push({
          id: sourceId,
          url: source.url,
          channelCount: channels.length,
          type: 'm3u'
        });
      } else if (source.type === 'dynamic') {
        // Handle JSON format
        const data = JSON.parse(content);
        if (data.sources) {
          // For dynamic sources, we would need to fetch the actual stream
          console.log(`  ${sourceId} has ${Object.keys(data.sources).length} source configurations`);
        }
        fetchedSources.push({
          id: sourceId,
          url: source.url,
          channelCount: 0,
          type: 'dynamic'
        });
      }
      
      console.log(`  Added ${source.type === 'm3u' ? channels.length : 0} channels`);
    } catch (error) {
      console.error(`  Error fetching ${sourceId}: ${error.message}`);
    }
  }
  
  return { allChannels, fetchedSources };
}

// Generate M3U playlist
function generateM3U(channels, config) {
  const header = `#EXTM3U
# Generated: ${new Date().toISOString()}
# Version: ${config.version}
# Source: https://github.com/akiralereal/iptv-aggregator
# Total Channels: ${channels.length}

`;
  
  let playlist = header;
  
  for (const channel of channels) {
    const attributes = [];
    
    // Add group
    const group = channel.groupTitle || 'Unknown';
    attributes.push(`group-title="${group}"`);
    
    // Add TVG name if available
    if (channel.tvgName) {
      attributes.push(`tvg-name="${channel.tvgName}"`);
    }
    
    // Add logo if available
    if (channel.tvgLogo) {
      attributes.push(`tvg-logo="${channel.tvgLogo}"`);
    }
    
    // Add TVG shift if available
    if (channel.tvgShift) {
      attributes.push(`tvg-shift=${channel.tvgShift}`);
    }
    
    const extinf = `#EXTINF:-1 ${attributes.join(' ')}${channel.url ? '' : ''}`;
    playlist += `${extinf}\n`;
    
    if (channel.url) {
      playlist += `${channel.url}\n`;
    }
    
    playlist += '\n';
  }
  
  return playlist;
}

// Main execution
async function main() {
  console.log('IPTV Source Aggregator - Generating playlist...\n');
  
  const { allChannels, fetchedSources } = await fetchSources();
  
  console.log(`\nTotal channels fetched: ${allChannels.length}`);
  console.log('Sources processed:', fetchedSources.length);
  
  // Generate M3U
  const m3uContent = generateM3U(allChannels, config);
  const m3uPath = join(OUTPUT_DIR, config.output.playlist);
  writeFileSync(m3uPath, m3uContent);
  console.log(`\nM3U playlist saved: ${m3uPath}`);
  
  // Generate TXT version
  const txtContent = allChannels.map(c => {
    const group = c.groupTitle || 'Unknown';
    const name = c.tvgName || group;
    const url = c.url || '# No URL';
    return `${name} | ${group} | ${url}`;
  }).join('\n');
  
  const txtPath = join(OUTPUT_DIR, config.output.txt);
  writeFileSync(txtPath, txtContent);
  console.log(`TXT playlist saved: ${txtPath}`);
  
  // Generate JSON index
  const jsonContent = {
    version: config.version,
    generated: new Date().toISOString(),
    totalChannels: allChannels.length,
    sources: fetchedSources,
    channels: allChannels.map(c => ({
      name: c.tvgName || c.groupTitle || 'Unknown',
      group: c.groupTitle || 'Unknown',
      logo: c.tvgLogo || '',
      url: c.url || '',
      source: c.source || ''
    }))
  };
  
  const jsonPath = join(OUTPUT_DIR, config.output.json);
  writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2));
  console.log(`JSON index saved: ${jsonPath}`);
  
  // Generate summary
  const byGroup = {};
  for (const channel of allChannels) {
    const group = channel.groupTitle || 'Unknown';
    byGroup[group] = (byGroup[group] || 0) + 1;
  }
  
  console.log('\nChannels by group:');
  Object.entries(byGroup)
    .sort((a, b) => b[1] - a[1])
    .forEach(([group, count]) => {
      console.log(`  ${group}: ${count}`);
    });
  
  console.log('\nPlaylist generation complete!');
  
  return { success: true, totalChannels: allChannels.length, byGroup };
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});