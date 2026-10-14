#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config', 'sources.json');
const OUTPUT_DIR = join(__dirname, '..', 'output');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load configuration
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

// Extra channels to add (user should replace URLs with actual streams)
const EXTRA_CHANNELS = [
  {
    name: 'CCTV-1 综合',
    groupTitle: '国内卫视',
    tvgName: 'CCTV-1',
    tvgLogo: '',
    url: 'http://example.com/cctv1.m3u8' // REPLACE WITH ACTUAL URL
  },
  {
    name: 'CCTV-2 财经',
    groupTitle: '国内卫视',
    tvgName: 'CCTV-2',
    tvgLogo: '',
    url: 'http://example.com/cctv2.m3u8' // REPLACE WITH ACTUAL URL
  },
  {
    name: 'CCTV-3 综艺',
    groupTitle: '国内卫视',
    tvgName: 'CCTV-3',
    tvgLogo: '',
    url: 'http://example.com/cctv3.m3u8' // REPLACE WITH ACTUAL URL
  },
  {
    name: 'CCTV-4 国际',
    groupTitle: '国内卫视',
    tvgName: 'CCTV-4',
    tvgLogo: '',
    url: 'http://example.com/cctv4.m3u8' // REPLACE WITH ACTUAL URL
  },
  {
    name: 'CCTV-5 体育',
    groupTitle: '国内卫视',
    tvgName: 'CCTV-5',
    tvgLogo: '',
    url: 'http://example.com/cctv5.m3u8' // REPLACE WITH ACTUAL URL
  },
  {
    name: 'CCTV-6 电影',
    groupTitle: '影视娱乐',
    tvgName: 'CCTV-6',
    tvgLogo: '',
    url: 'http://example.com/cctv6.m3u8' // REPLACE WITH ACTUAL URL
  },
  {
    name: 'CCTV-8 电视剧',
    groupTitle: '影视娱乐',
    tvgName: 'CCTV-8',
    tvgLogo: '',
    url: 'http://example.com/cctv8.m3u8' // REPLACE WITH ACTUAL URL
  },
  {
    name: '北京卫视',
    groupTitle: '地方频道',
    tvgName: '北京卫视',
    tvgLogo: '',
    url: 'http://example.com/bjtv.m3u8' // REPLACE WITH ACTUAL URL
  },
  {
    name: '上海卫视',
    groupTitle: '地方频道',
    tvgName: '上海卫视',
    tvgLogo: '',
    url: 'http://example.com/shwtv.m3u8' // REPLACE WITH ACTUAL URL
  },
  {
    name: '广东卫视',
    groupTitle: '地方频道',
    tvgName: '广东卫视',
    tvgLogo: '',
    url: 'http://example.com/gdtv.m3u8' // REPLACE WITH ACTUAL URL
  }
];

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

// Fetch with timeout using AbortController and retry
async function fetchWithRetry(url, options = {}, timeout = 30000, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeout);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

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
      const response = await fetchWithRetry(source.url, {
        headers: {
          'User-Agent': config.verification.userAgent,
          'Accept': 'text/plain,application/json,*/*'
        }
      }, config.verification.timeout, 3);
      
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
  
  let allChannels = [];
  let fetchedSources = [];
  
  try {
    const result = await fetchSources();
    allChannels = result.allChannels;
    fetchedSources = result.fetchedSources;
  } catch (error) {
    console.error('Failed to fetch sources:', error.message);
    // Continue with empty allChannels, we'll still add extra channels
  }
  
  console.log(`\nTotal channels fetched from sources: ${allChannels.length}`);
  
  // Add extra channels
  allChannels.push(...EXTRA_CHANNELS);
  
  console.log(`Added ${EXTRA_CHANNELS.length} extra channels. Total: ${allChannels.length}`);
  
  // If still no channels, we should at least have extra channels
  if (allChannels.length === 0) {
    throw new Error('No channels available even after adding extra channels');
  }
  
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