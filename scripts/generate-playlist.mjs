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
    let line = lines[i].trim();
    
    // Skip empty lines and comments (except EXTINF)
    if (!line || (line.startsWith('#') && !line.startsWith('#EXTINF:'))) {
      continue;
    }
    
    if (line.startsWith('#EXTINF:')) {
      // Parse EXTINF line: #EXTINF:<duration>[,<channel name>]
      // Optional attributes can appear between duration and channel name
      const extinfMatch = line.match(/^#EXTINF:(-?\d+)(?:[^,]*,)?(.*)$/);
      if (extinfMatch) {
        const duration = extinfMatch[1];
        let afterDuration = extinfMatch[2] || ''; // This contains attributes and channel name
        
        // Now we need to split attributes from the actual channel name
        // The channel name is everything after the last comma that's not inside quotes
        // But for simplicity, we'll assume the channel name is after the last comma
        const lastCommaIndex = afterDuration.lastIndexOf(',');
        let channelName = '';
        let attributesStr = '';
        
        if (lastCommaIndex !== -1) {
          channelName = afterDuration.substring(lastCommaIndex + 1).trim();
          attributesStr = afterDuration.substring(0, lastCommaIndex).trim();
        } else {
          // No comma found, treat everything as channel name
          channelName = afterDuration.trim();
        }
        
        // Parse attributes from attributesStr
        const attributes = {};
        
        // Extract group-title
        const groupMatch = attributesStr.match(/group-title="([^"]*)"/);
        if (groupMatch) {
          attributes.groupTitle = groupMatch[1];
        }
        
        // Extract tvg-name
        const tvgNameMatch = attributesStr.match(/tvg-name="([^"]*)"/);
        if (tvgNameMatch) {
          attributes.tvgName = tvgNameMatch[1];
        }
        
        // Extract tvg-logo
        const tvgLogoMatch = attributesStr.match(/tvg-logo="([^"]*)"/);
        if (tvgLogoMatch) {
          attributes.tvgLogo = tvgLogoMatch[1];
        }
        
        // If we still don't have a channel name from the attributes parsing,
        // use what we extracted after the last comma
        if (!channelName) {
          channelName = '';
        }
        
        // Determine the final channel name to use
        let finalName = channelName;
        if (!finalName || finalName.trim() === '') {
          // Try to use tvg-name
          finalName = attributes.tvgName || '';
        }
        if (!finalName || finalName.trim() === '') {
          // Try to use group-title
          finalName = attributes.groupTitle || '';
        }
        if (!finalName || finalName.trim() === '') {
          // Default
          finalName = '未知频道';
        }
        
        finalName = finalName.trim();
        
        currentChannel = {
          url: '',
          groupTitle: attributes.groupTitle || 'Unknown',
          tvgName: attributes.tvgName || '',
          tvgLogo: attributes.tvgLogo || '',
          name: finalName // This is what will be displayed
        };
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

// Fetch with timeout using AbortController
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// Fetch channel info from GitHub raw URL
async function fetchSources() {
  const allChannels = [];
  const fetchedSources = [];
  
  for (const [sourceId, source] of Object.entries(config.sources)) {
    if (!source.enabled) continue;
    
    console.log(`Fetching ${sourceId}...`);
    
    try {
      const response = await fetchWithTimeout(source.url, {
        headers: {
          'User-Agent': config.verification.userAgent,
          'Accept': 'text/plain,application/json,*/*'
        }
      }, config.verification.timeout);
      
      if (!response.ok) {
        console.error(`Failed to fetch ${sourceId}: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const content = await response.text();
      const channels = parseM3U(content, source.name || sourceId);
      allChannels.push(...channels);
      fetchedSources.push({
        id: sourceId,
        name: source.name || sourceId,
        url: source.url,
        channelCount: channels.length
      });
      
      console.log(`Successfully fetched ${sourceId}: ${channels.length} channels`);
    } catch (error) {
      console.error(`Error fetching ${sourceId}:`, error.message);
    }
  }
  
  return { allChannels, fetchedSources };
}

// Generate M3U playlist with proper formatting for VLC
function generateM3U(channels) {
  let m3uContent = '#EXTM3U\n';
  
  for (const channel of channels) {
    // Use the name we determined during parsing
    let displayName = channel.name || '未知频道';
    
    // Ensure it's not empty
    if (!displayName || displayName.trim() === '') {
      displayName = '未知频道';
    }
    
    displayName = displayName.trim();
    
    // Build EXTINF line
    let extinf = '#EXTINF:-1';
    
    // Add group-title if available and meaningful
    if (channel.groupTitle && channel.groupTitle !== 'Unknown' && channel.groupTitle.trim() !== '') {
      extinf += ` group-title="${channel.groupTitle.trim()}"`;
    }
    
    // Add the channel name after the comma
    extinf += `,${displayName}`;
    
    m3uContent += `${extinf}\n${channel.url}\n`;
  }
  
  return m3uContent;
}

// Generate JSON index
function generateJSONIndex(channels, sources) {
  return {
    version: "1.0",
    generated: new Date().toISOString(),
    totalChannels: channels.length,
    sources: sources.map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      channelCount: s.channelCount,
      type: s.type || 'unknown'
    })),
    channels: channels.map(c => ({
      name: c.name,
      group: c.groupTitle,
      logo: c.tvgLogo,
      url: c.url,
      source: c.source
    }))
  };
}

// Main function
async function main() {
  console.log('Starting IPTV playlist generation...');
  
  const { allChannels, fetchedSources } = await fetchSources();
  
  if (allChannels.length === 0) {
    throw new Error('No channels fetched from any source');
  }
  
  console.log(`\nTotal channels fetched: ${allChannels.length}`);
  
  // Generate M3U playlist
  const m3uContent = generateM3U(allChannels);
  const m3uPath = join(OUTPUT_DIR, 'iptv-aggregated.m3u');
  writeFileSync(m3uPath, m3uContent);
  console.log(`M3U playlist saved: ${m3uPath}`);
  
  // Generate JSON index
  const jsonContent = generateJSONIndex(allChannels, fetchedSources);
  const jsonPath = join(OUTPUT_DIR, 'channels.json');
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