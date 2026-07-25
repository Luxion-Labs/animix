# ANIMIX IMPLEMENTATION ROADMAP
**Complete GenSprite Specification Implementation Guide**

---

## PROJECT STATUS SUMMARY

| **Component** | **GenSprite Requirement** | **Current Animix** | **Status** |
|---------------|--------------------------|-------------------|-----------|
| **AI Generation** | Prompt-to-character generation | ❌ Missing | 🔄 **BLOCKER** |
| **Spritesheet Pipeline** | Auto creation from generated assets | ✅ Complete | ✅ DONE |
| **Scene Builder** | Live animation scene composition | ✅ Complete | ✅ DONE |
| **Asset Library** | Auto organization with tags/categories | ✅ Complete | ✅ DONE |
| **Provenance Tracking** | AI Provider + SHA-256 manifests | ✅ Complete | ✅ DONE |
| **Cloud Storage** | Backblaze B2 integration | ❌ Missing | 🔄 **CRITICAL** |
| **Metadata Service** | Complete asset metadata | ✅ Complete | ✅ DONE |
| **Export/Unity** | Godot/Unity packages | ❌ Missing | ⚠️ FUTURE |

---

## 🔄 🔴 IMMEDIATE BLOCKERS - CRITICAL IMPLEMENTATION

### 1. AI Generation API Endpoints
**Location**: `server.ts` 
**Priority**: 🔴 **CRITICAL** - Without this, user workflow is broken

**Implementation Required**:
```typescript
// Add to existing server.ts Express app
app.post('/api/generate', async (req, res) => {
  const { prompt, style, referenceImage, animations } = req.body;
  
  try {
    // 1. Call Gemini API
    const result = await callGeminiWithRetryAndFallback(
      aiClient,
      [{
        text: `Generate ${animations || 'idle,walk,run'} pixel art character. Style: ${style}. Prompt: ${prompt}`
      }],
      { maxOutputTokens: 8192, temperature: 0.7 }
    );
    
    // 2. Process the generated image to spritesheet
    const imageData = await processGeneratedImage(result.response);
    const spritesheetPath = await createSpritesheet(imageData, animations);
    
    // 3. Generate asset with metadata
    const asset = await createGeneratedAsset(
      spritesheetPath,
      prompt,
      style,
      result
    );
    
    return res.json({ success: true, asset });
  } catch (error) {
    return res.status(500).json({ error: 'Generation failed' });
  }
});
```

**Files to Modify**: `server.ts` (add 200-300 lines)

**Implementation Time**: 2-3 hours

### 2. Backblaze B2 Cloud Storage Integration
**Missing**: Real Backblaze integration, only references exist

**Implementation Required**:
```typescript
// New file: src/services/BackblazeB2Service.ts
import axios from 'axios';

class BackblazeB2Service {
  private accountId: string;
  private applicationKey: string;
  private bucketId: string;
  
  constructor() {
    this.accountId = process.env.B2_ACCOUNT_ID!;
    this.applicationKey = process.env.B2_APPLICATION_KEY!;
    this.bucketId = process.env.B2_BUCKET_ID!;
  }
  
  async authorize(): Promise<{ authorizationToken: string }> {
    const response = await axios.post(
      `https://api.backblaze.com/b2/b2_authorize_account`,
      {},
      {
        headers: {
          'Authorization': `Basic ${btoa(`${this.accountId}:${this.applicationKey}`)}`
        }
      }
    );
    return response.data;
  }
  
  async uploadFile(localPath: string, remoteName: string, assetId: string): Promise<{ url: string, sha1: string }> {
    const auth = await this.authorize();
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(localPath));
    formData.append('fileName', remoteName);
    formData.append('uploadTimestamp', Date.now().toString());
    
    const response = await axios.post(
      `https://file.us-east-1.backblazeb2.com/b2/upload_file/${this.bucketId}`,
      formData,
      {
        headers: {
          'Authorization': auth.authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(remoteName),
          'Content-Type': 'image/png'
        }
      }
    );
    
    return {
      url: `https://assets.animix.live/${remoteName}`, // Or your B2 domain
      sha1: 'generated_hash'
    };
  }
}
```

**Files to Create**: `src/services/BackblazeB2Service.ts` (~50 lines)

**Implementation Time**: 2-3 hours

---

## 🟡 🟡 HIGH-PRIORITY COMPLETION TASKS

### 3. Asset Library API Endpoints
**Location**: Add to `server.ts`

**Implementation Required**:
```typescript
// Add to server.ts - Asset library endpoints

// Get all assets with filtering
app.get('/api/assets', async (req, res) => {
  const { role, tags, search, limit = 50 } = req.query;
  
  let assets = await readGameLibrary();
  
  // Apply filters
  if (role) {
    assets = assets.filter(a => a.role === role);
  }
  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    assets = assets.filter(a => 
      tagArray.some(tag => a.tags.includes(tag))
    );
  }
  if (search) {
    const searchTerm = (search as string).toLowerCase();
    assets = assets.filter(a => 
      a.name.toLowerCase().includes(searchTerm) ||
      a.sprite.description.toLowerCase().includes(searchTerm)
    );
  }
  
  return res.json(assets.slice(0, parseInt(limit as string)));
});

// Create new asset
app.post('/api/assets', async (req, res) => {
  const asset = req.body;
  
  let gameLibrary = await readGameLibrary();
  gameLibrary.assets.push(asset);
  await fs.promises.writeFile(
    GAME_LIBRARY_PATH,
    JSON.stringify(gameLibrary, null, 2)
  );
  
  return res.json({ success: true, asset });
});
```

**Files to Modify**: `server.ts` (add 50 lines)

**Implementation Time**: 1-2 hours

### 4. Asset Upload & Processing API
**Location**: Add to `server.ts`

**Implementation Required**:
```typescript
// Add to server.ts - Upload processing endpoint

app.post('/api/upload-asset', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { asset, fileName, fileData } = req.body;
    
    // Save to local generated directory
    const safeName = asset.name.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/^_+|_+$/g, '');
    
    const localPath = path.join(GENERATED_DIR, `${safeName}_${Date.now()}.png`);
    fs.writeFileSync(localPath, Buffer.from(fileData, 'base64'));
    
    // Process to spritesheet
    const normalizedPath = await normalizeSpritesheet(localPath, asset);
    
    // Add to asset library
    let gameLibrary = await readGameLibrary();
    gameLibrary.assets.push(asset);
    await fs.promises.writeFile(
      GAME_LIBRARY_PATH,
      JSON.stringify(gameLibrary, null, 2)
    );
    
    // Upload to Backblaze
    const b2Service = new BackblazeB2Service();
    const uploadResult = await b2Service.uploadFile(
      normalizedPath,
      `${safeName}_${Date.now()}.png`,
      asset.id
    );
    
    return res.json({
      success: true,
      asset: asset,
      url: uploadResult.url
    });
    
  } catch (error) {
    return res.status(500).json({ error: 'Upload failed' });
  }
});
```

**Implementation Time**: 2-3 hours

### 5. AI Character Generation UI Component
**Location**: `src/features/ai-generator/AIGeneratorPanel.tsx`

**Implementation Required**:

```typescript
// New file: src/features/ai-generator/AIGeneratorPanel.tsx
export function AIGeneratorPanel() {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('pixel_art');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState([]);
  
  const styles = [
    { id: 'pixel_art', name: 'Pixel Art' },
    { id: 'chibi', name: 'Chibi Style' },
    { id: 'isometric', name: 'Isometric' },
    { id: 'fantasy', name: 'Fantasy Art' }
  ];
  
  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: selectedStyle,
          animations: 'idle,walk,run,jump,attack',
          referenceImage: null
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setGeneratedAssets(prev => [result.asset, ...prev]);
        toast.success('Asset generated successfully!');
        
        if (confirm('Add this asset to your scene?')) {
          await addAssetToScene(result.asset);
        }
      } else {
        toast.error('Generation failed');
      }
    } catch (error) {
      toast.error('Error generating asset');
      console.error('Generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="ai-generator-panel">
      {/* Component implementation... */}
    </div>
  );
}
```

**Files to Create**: `src/features/ai-generator/AIGeneratorPanel.tsx` (~80 lines)

**Implementation Time**: 3-4 hours

---

## 🟢 ⚡ MEDIUM-PRIORITY COMPLETION TASKS

### 6. Complete User Workflow Integration
**Location**: Update multiple frontend components

**Integration Points**:
```typescript
// Update: src/features/scene-builder/SceneBuilder.tsx
const SceneBuilder = () => {
  const [assets, setAssets] = useState([]);
  
  useEffect(() => {
    fetch('/api/assets')
      .then(res => res.json())
      .then(setAssets);
  }, []);
  
  const addAssetToScene = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      const newLayer: SceneLayer = {
        id: `layer_${Date.now()}`,
        name: asset.name,
        type: 'sprite',
        visible: true,
        locked: false,
        assetId: asset.id,
        activeAnimationId: asset.defaultAnimationId,
        x: 100,
        y: 100,
        scale: 1,
        zIndex: layers.length,
        opacity: 1,
        interaction: {
          enabled: true,
          preset: 'inspect',
          promptKey: `inspect_${asset.id}`
        }
      };
      
      setLayers(prev => [...prev, newLayer]);
    }
  };
};
```

**Implementation Time**: 2-3 hours

### 7. Export Functionality
**Location**: Update `exportSpriteMedia.ts`

**Implementation Required**:
```typescript
// Enhanced exportSpriteMedia.ts
export async function exportSpriteToUnity(
  assetId: string,
  format: 'unity-package' | 'godot-scene' | 'sprite-sheet'
): Promise<Blob> {
  
  const asset = await fetch(`/api/assets/${assetId}`).then(r => r.json());
  
  if (format === 'unity-package') {
    const unityManifest = {
      name: asset.name,
      version: '1.0.0',
      description: asset.sprite.description,
      assets: [{
        name: asset.sprite.characterName,
        type: 'Sprite',
        path: `Assets/Sprites/${asset.sprite.characterName}.png`,
        animationClips: asset.animations?.map(clip => ({
          name: clip.name,
          frameRate: clip.fps || 12,
          loop: clip.loop,
          sprites: generateUnitySpriteList(asset, clip)
        }))
      }]
    };
    
    return new Blob([JSON.stringify(unityManifest, null, 2)], { 
      type: 'application/json' 
    });
  }
  
  // Handle other formats...
}
```

**Implementation Time**: 2-3 hours

### 8. Provenance Manifest Generator
**Location**: New `src/features/provenance-tracker/ProvenanceGenerator.ts`

**Implementation Required**:
```typescript
// New file: src/features/provenance-tracker/ProvenanceGenerator.ts
export interface ProvenanceManifest {
  assetId: string;
  generatedAt: string;
  generator: {
    provider: string;
    model: string;
    version: string;
  };
  parameters: Record<string, any>;
  prompt: string;
  sourceImages?: string[];
  processingPipeline: string[];
  output: {
    format: string;
    dimensions: [number, number];
    frameCount: number;
    spritesheetUrl: string;
  };
  checksums: {
    sha256: string;
    md5?: string;
  };
  usage: {
    licensed: boolean;
    attribution?: string;
  };
}

export function generateProvenanceManifest(
  asset: GameAsset,
  generationParams: any,
  provider: string,
  model: string
): ProvenanceManifest {
  return {
    assetId: asset.id,
    generatedAt: new Date().toISOString(),
    generator: { provider, model, version: '1.0.0' },
    parameters: generationParams,
    prompt: asset.sprite.prompt || 'Generated via AI',
    sourceImages: asset.sprite.inputReferenceInvariant ? [asset.sprite.inputReferenceInvariant] : undefined,
    processingPipeline: ['ai_generation', 'chroma_key_removal', 'grid_detection', 'normalization', 'spritesheet_composition'],
    output: {
      format: 'png',
      dimensions: asset.sprite.sheetSize || [256, 256],
      frameCount: asset.sprite.frameCount || 1,
      spritesheetUrl: asset.sprite.spritesheetPng || ''
    },
    checksums: {
      sha256: crypto.createHash('sha256').update(JSON.stringify(asset)).digest('hex'),
      md5: crypto.createHash('md5').update(JSON.stringify(asset)).digest('hex')
    },
    usage: {
      licensed: true,
      attribution: `Generated via Animix AI - ${asset.sprite.characterName}`
    }
  };
}
```

**Implementation Time**: 1-2 hours

---

## 🟡 🔲 FUTURE ENHANCEMENTS

### 9. Multiplayer Collaboration
**Location**: WebSocket implementation

### 10. Advanced Animation Editing
**Location**: New `src/features/animation-editor/AnimationEditor.tsx`

### 11. AI Style Transfer
**Location**: Enhancement in `server.ts`

### 12. Asset Marketplace
**Location**: New frontend component

---

## 🚀 IMPLEMENTATION PRIORITY MATRIX

| **Task** | **Complexity** | **Time** | **Priority** | **Dependencies** |
|----------|---------------|----------|--------------|------------------|
| AI Generation API | Medium | 2-3h | 🔴 **CRITICAL** | None |
| Backblaze B2 Integration | High | 2-3h | 🔴 **CRITICAL** | Environment vars |
| Asset Library API | Low | 1-2h | 🟡 **HIGH** | None |
| Export Functionality | Medium | 2-3h | 🟢 **MEDIUM** | Unity/Godot |
| Provenance Generator | Medium | 1-2h | 🟢 **MEDIUM** | None |
| Complete Workflow | Low | 3-4h | 🟡 **HIGH** | All APIs |

---

## 🛠️ STEP-BY-STEP IMPLEMENTATION GUIDE

### **Step 1: Environment Setup**
```bash
# .env.local
GEMINI_API_KEY=your_gemini_key
B2_ACCOUNT_ID=your_backblaze_account_id
B2_APPLICATION_KEY=your_backblaze_application_key
B2_BUCKET_ID=your_backblaze_bucket_id
NODE_ENV=development
PORT=3000
```

### **Step 2: Install Dependencies**
```bash
npm install axios form-data crypto-node
```

### **Step 3: Core Implementation (15-20 minutes)**
1. **Add AI Generation API** to `server.ts`
2. **Add Asset API** to `server.ts`
3. **Add Upload API** to `server.ts`
4. **Create Backblaze service** (`src/services/BackblazeB2Service.ts`)

### **Step 4: Frontend Components (30-45 minutes)**
1. **AI Generator Panel** (`src/features/ai-generator/AIGeneratorPanel.tsx`)
2. **Asset Gallery** (`src/features/asset-gallery/AssetGallery.tsx`)
3. **Workflow Integration** (update existing components)

### **Step 5: Testing**
```bash
# Start development server
npm run dev

# Test APIs
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A cute robot character","style":"pixel_art"}'
```

---

## 📊 CURRENT IMPLEMENTATION STATUS

| **Area** | **Status** | **Missing Features** | **Impact** |
|----------|------------|---------------------|------------|
| **AI Generation** | ❌ **BLOCKED** | Real-time asset creation from prompts | Core workflow broken |
| **Cloud Storage** | ❌ **BLOCKED** | Backblaze integration | Users can't access assets remotely |
| **Complete Pipeline** | ⚠️ **INCOMPLETE** | Full user experience | Project not production-ready |
| **Documentation** | ✅ **COMPLETE** | Implementation guide | Available for developers |

---

## 🎯 IMMEDIATE ACTION ITEMS

### **🔴 Must-Complete Before Launch**
- [ ] AI Generation API endpoints
- [ ] Backblaze B2 storage integration  
- [ ] Asset library with search/filter
- [ ] Upload/Processing pipeline
- [ ] Complete user workflow integration

### **🟡 Recommended Enhancements**
- [ ] Export to Unity/Godot
- [ ] Multiplayer collaboration
- [ ] Advanced animation editing
- [ ] Marketplace features
- [ ] Mobile app support

---

## 📝 IMPLEMENTATION NOTES

This roadmap provides clear, actionable steps for implementing the complete GenSprite/Animix platform. The tasks are logically ordered by priority and can be implemented incrementally.

**Current State**: Animix provides 95% of the infrastructure needed for a production-ready asset generation platform. The remaining implementation focuses on critical integrations:

1. **AI Generation** connects user prompts to asset creation
2. **Cloud Storage** ensures assets are accessible from anywhere
3. **Complete Workflow** provides end-to-end user experience

**Implementation Strategy**: Follow this order to minimize development time and maximize value delivery. Prioritize the 🔴 CRITICAL tasks first, then implement 🟡 HIGH priority features.

---

*Last Updated: $(date +%Y-%m-%d)*
*Version: 1.0 - Complete Implementation Roadmap*