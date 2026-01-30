# Schedule C Assistant - Product Commercial 🎬

A professional 15-second product animation created with Remotion for your Schedule C Tax Assistant.

## 🎥 Commercial Overview

**Duration**: 15 seconds (450 frames at 30fps)  
**Resolution**: 1920x1080 (Full HD)  
**Format**: MP4

### 📋 Scenes Breakdown:

1. **Opening** (0-2s): Logo reveal with blue gradient background
2. **Problem** (2-4s): "Tax Season Stress?" - highlighting pain points
3. **Upload** (4-6s): "Simple Solution" - upload CSV files
4. **Categorize** (6-8s): "AI Auto-Categorization" - smart features
5. **Results** (8-10s): "Instant Overview" - animated dollar amount
6. **Export** (10-12s): "Export & Done" - send to accountant
7. **Closing** (12-15s): Call-to-action with "Get Started Today"

---

## 🚀 How to Use

### **Option 1: Preview in Remotion Studio** (Recommended)

The studio is already running! Open your browser:

**http://localhost:3004**

You'll see:
- Live preview of the animation
- Timeline scrubber to navigate frames
- Play/pause controls
- Real-time editing

### **Option 2: Render the Video**

To create the final MP4 file:

\`\`\`bash
cd commercial-video
npm run build
\`\`\`

The video will be saved to: `out/video.mp4`

---

## 🎨 Customization

### Edit the Animation

Open `src/ScheduleCCommercial.tsx` and modify:

**Colors**:
- Change gradients in each scene
- Update brand colors

**Text**:
- Modify headlines and copy
- Change font sizes

**Timing**:
- Adjust `durationInFrames` for each `<Sequence>`
- Speed up or slow down animations

**Content**:
- Add more scenes
- Change emojis and icons
- Update dollar amounts

### Example Changes:

\`\`\`typescript
// Change the opening gradient
background: 'linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%)'

// Change the dollar amount
const amount = Math.floor(interpolate(frame, [10, 40], [0, YOUR_AMOUNT]));

// Change scene duration
<Sequence from={0} durationInFrames={90}> // 3 seconds instead of 2
\`\`\`

---

## 🎬 Scene Details

### Scene 1: Opening
- **Effect**: Spring animation logo reveal
- **Colors**: Blue gradient (#1e3a8a → #60a5fa)
- **Text**: "Schedule C Assistant" + tagline

### Scene 2: Problem
- **Effect**: Fade in + slide up
- **Colors**: Dark gradient (#1f2937 → #111827)
- **Emoji**: 😰
- **Message**: Highlights user pain points

### Scene 3: Upload
- **Effect**: Spring scale animation
- **Colors**: Dark blue with bright blue card
- **Icon**: 📤 in blue gradient box
- **Message**: Step 1 - Upload files

### Scene 4: Categorize
- **Effect**: Staggered spring animations
- **Colors**: Category-specific colors (blue, cyan, orange)
- **Icons**: 📦 ✈️ 🍔
- **Message**: AI auto-categorization

### Scene 5: Results
- **Effect**: Animated counter + spring scale
- **Colors**: Green gradient (#064e3b → #047857)
- **Animation**: Number counts from $0 to $12,456
- **Message**: Instant overview

### Scene 6: Export
- **Effect**: Spring scale checkmark
- **Colors**: Blue gradient
- **Icon**: ✅
- **Message**: Send to accountant

### Scene 7: Closing CTA
- **Effect**: Double spring (logo + button)
- **Colors**: Blue gradient background, white button
- **Text**: "Get Started Today" + URL
- **Duration**: 3 seconds (longer for impact)

---

## 📐 Technical Specifications

### Video Settings:
- **FPS**: 30 frames per second
- **Width**: 1920px
- **Height**: 1080px
- **Total Frames**: 450
- **Duration**: 15 seconds
- **Format**: MP4 (H.264)

### Animation Types Used:
- **Spring animations**: Natural, bouncy movements
- **Interpolations**: Smooth transitions
- **Sequences**: Scene timing and layering
- **Gradients**: Modern, professional look

---

## 🎯 Use Cases

### Where to Use This Commercial:

1. **Website Hero Section**: Autoplay on homepage
2. **Social Media**:
   - Instagram Reels
   - TikTok
   - Twitter/X
   - LinkedIn
3. **Product Hunt Launch**: Feature video
4. **Email Marketing**: Embedded in campaigns
5. **Demo Presentations**: Client pitches
6. **App Store**: Preview video

### Export Formats:

**For Web**:
\`\`\`bash
remotion render ScheduleCCommercial out/web.mp4 --codec h264 --quality 80
\`\`\`

**For Social Media** (Square):
\`\`\`bash
# Edit Root.tsx to change dimensions to 1080x1080
remotion render ScheduleCCommercial out/social.mp4
\`\`\`

**For High Quality**:
\`\`\`bash
remotion render ScheduleCCommercial out/hq.mp4 --codec h264-mkv --quality 100
\`\`\`

---

## 🎨 Design Principles

### Visual Style:
- **Modern gradients**: Blue, green, dark themes
- **Clean typography**: Bold headlines, readable copy
- **Smooth animations**: Spring physics for natural feel
- **Professional**: Suitable for B2B and B2C

### Color Psychology:
- **Blue**: Trust, professionalism, technology
- **Green**: Success, money, growth
- **Red**: Urgency, problems (used sparingly)
- **Dark backgrounds**: Premium, modern feel

### Animation Principles:
- **Anticipation**: Spring animations build excitement
- **Timing**: 2 seconds per scene for readability
- **Emphasis**: Scale and color draw attention
- **Clarity**: One message per scene

---

## 🔧 Troubleshooting

### Studio won't open?
\`\`\`bash
# Kill existing process
lsof -ti:3004 | xargs kill -9

# Restart
npm start
\`\`\`

### Render fails?
\`\`\`bash
# Check for errors
npm run build -- --log=verbose
\`\`\`

### Slow preview?
- Lower preview quality in Remotion Studio
- Close other applications
- Reduce frame rate temporarily

---

## 📚 Resources

- **Remotion Docs**: https://remotion.dev
- **Animation Examples**: https://remotion.dev/showcase
- **Community**: https://remotion.dev/discord

---

## 🎬 Next Steps

1. **Preview**: Open http://localhost:3004
2. **Customize**: Edit colors, text, timing
3. **Render**: Run `npm run build`
4. **Share**: Upload to your platforms!

---

## 💡 Pro Tips

### Make it Yours:
- Add your logo/branding
- Use your brand colors
- Include real screenshots
- Add background music
- Record voiceover

### Optimize for Platform:
- **Instagram**: 1080x1080 (square)
- **YouTube**: 1920x1080 (landscape)
- **TikTok**: 1080x1920 (vertical)
- **Twitter**: 1280x720 (landscape)

### A/B Test:
- Create multiple versions
- Test different CTAs
- Try various color schemes
- Experiment with timing

---

**Ready to preview?** Open http://localhost:3004 in your browser! 🚀
