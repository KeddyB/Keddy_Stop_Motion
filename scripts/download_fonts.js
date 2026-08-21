const fs = require('fs');
const path = require('path');
const https = require('https');

const FONTS = [
  // 🎮 Pixel & 8-Bit (12)
  { id: 'PressStart2P', name: 'Press Start 2P', category: 'pixel', file: 'PressStart2P-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/PressStart2P-Regular.ttf' },
  { id: 'VT323', name: 'VT323', category: 'pixel', file: 'VT323-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/vt323/VT323-Regular.ttf' },
  { id: 'Silkscreen', name: 'Silkscreen', category: 'pixel', file: 'Silkscreen-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/silkscreen/Silkscreen-Regular.ttf' },
  { id: 'DotGothic16', name: 'DotGothic16', category: 'pixel', file: 'DotGothic16-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/dotgothic16/DotGothic16-Regular.ttf' },
  { id: 'BlackOpsOne', name: 'Black Ops One', category: 'pixel', file: 'BlackOpsOne-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/blackopsone/BlackOpsOne-Regular.ttf' },
  { id: 'RubikGlitch', name: 'Rubik Glitch', category: 'pixel', file: 'RubikGlitch-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/rubikglitch/RubikGlitch-Regular.ttf' },
  { id: 'ChakraPetch', name: 'Chakra Petch', category: 'pixel', file: 'ChakraPetch-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/chakrapetch/ChakraPetch-Bold.ttf' },
  { id: 'Quantico', name: 'Quantico', category: 'pixel', file: 'Quantico-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/quantico/Quantico-Bold.ttf' },
  { id: 'AudiowidePixel', name: 'Audiowide', category: 'pixel', file: 'Audiowide-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/audiowide/Audiowide-Regular.ttf' },
  { id: 'Wallpoet', name: 'Wallpoet', category: 'pixel', file: 'Wallpoet-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/wallpoet/Wallpoet-Regular.ttf' },
  { id: 'Megrim', name: 'Megrim', category: 'pixel', file: 'Megrim.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/megrim/Megrim.ttf' },
  { id: 'GeostarFill', name: 'Geostar Fill', category: 'pixel', file: 'GeostarFill-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/geostarfill/GeostarFill-Regular.ttf' },

  // 🎬 Cinematic & Titles (18)
  { id: 'Cinzel', name: 'Cinzel', category: 'cinematic', file: 'Cinzel-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf' },
  { id: 'CinzelDecorative', name: 'Cinzel Decorative', category: 'cinematic', file: 'CinzelDecorative-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzeldecorative/CinzelDecorative-Bold.ttf' },
  { id: 'BebasNeue', name: 'Bebas Neue', category: 'cinematic', file: 'BebasNeue-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf' },
  { id: 'Anton', name: 'Anton', category: 'cinematic', file: 'Anton-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf' },
  { id: 'Oswald', name: 'Oswald', category: 'cinematic', file: 'Oswald-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf' },
  { id: 'Montserrat', name: 'Montserrat', category: 'cinematic', file: 'Montserrat-Black.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf' },
  { id: 'PlayfairDisplay', name: 'Playfair Display', category: 'cinematic', file: 'PlayfairDisplay-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf' },
  { id: 'Prata', name: 'Prata', category: 'cinematic', file: 'Prata-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/prata/Prata-Regular.ttf' },
  { id: 'CastoroTitling', name: 'Castoro Titling', category: 'cinematic', file: 'CastoroTitling-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/castorotitling/CastoroTitling-Regular.ttf' },
  { id: 'CormorantGaramond', name: 'Cormorant Garamond', category: 'cinematic', file: 'CormorantGaramond-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf' },
  { id: 'AbrilFatface', name: 'Abril Fatface', category: 'cinematic', file: 'AbrilFatface-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/abrilfatface/AbrilFatface-Regular.ttf' },
  { id: 'Federo', name: 'Federo', category: 'cinematic', file: 'Federo-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/federo/Federo-Regular.ttf' },
  { id: 'Staatliches', name: 'Staatliches', category: 'cinematic', file: 'Staatliches-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/staatliches/Staatliches-Regular.ttf' },
  { id: 'YesevaOne', name: 'Yeseva One', category: 'cinematic', file: 'YesevaOne-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/yesevaone/YesevaOne-Regular.ttf' },
  { id: 'Marcellus', name: 'Marcellus', category: 'cinematic', file: 'Marcellus-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/marcellus/Marcellus-Regular.ttf' },
  { id: 'UnifrakturMaguntia', name: 'Unifraktur', category: 'cinematic', file: 'UnifrakturMaguntia-Book.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/unifrakturmaguntia/UnifrakturMaguntia-Book.ttf' },
  { id: 'Italiana', name: 'Italiana', category: 'cinematic', file: 'Italiana-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/italiana/Italiana-Regular.ttf' },
  { id: 'Ultra', name: 'Ultra', category: 'cinematic', file: 'Ultra-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/ultra/Ultra-Regular.ttf' },

  // ✍️ Cursive & Calligraphy (20)
  { id: 'GreatVibes', name: 'Great Vibes', category: 'cursive', file: 'GreatVibes-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf' },
  { id: 'DancingScript', name: 'Dancing Script', category: 'cursive', file: 'DancingScript-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf' },
  { id: 'Pacifico', name: 'Pacifico', category: 'cursive', file: 'Pacifico-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/pacifico/Pacifico-Regular.ttf' },
  { id: 'Sacramento', name: 'Sacramento', category: 'cursive', file: 'Sacramento-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sacramento/Sacramento-Regular.ttf' },
  { id: 'Satisfy', name: 'Satisfy', category: 'cursive', file: 'Satisfy-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/satisfy/Satisfy-Regular.ttf' },
  { id: 'Allura', name: 'Allura', category: 'cursive', file: 'Allura-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/allura/Allura-Regular.ttf' },
  { id: 'AlexBrush', name: 'Alex Brush', category: 'cursive', file: 'AlexBrush-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/alexbrush/AlexBrush-Regular.ttf' },
  { id: 'Parisienne', name: 'Parisienne', category: 'cursive', file: 'Parisienne-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/parisienne/Parisienne-Regular.ttf' },
  { id: 'Caveat', name: 'Caveat', category: 'cursive', file: 'Caveat-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/Caveat%5Bwght%5D.ttf' },
  { id: 'Kalam', name: 'Kalam', category: 'cursive', file: 'Kalam-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/kalam/Kalam-Bold.ttf' },
  { id: 'MarckScript', name: 'Marck Script', category: 'cursive', file: 'MarckScript-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/marckscript/MarckScript-Regular.ttf' },
  { id: 'Courgette', name: 'Courgette', category: 'cursive', file: 'Courgette-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/courgette/Courgette-Regular.ttf' },
  { id: 'Yellowtail', name: 'Yellowtail', category: 'cursive', file: 'Yellowtail-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/yellowtail/Yellowtail-Regular.ttf' },
  { id: 'HomemadeApple', name: 'Homemade Apple', category: 'cursive', file: 'HomemadeApple-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/homemadeapple/HomemadeApple-Regular.ttf' },
  { id: 'Damion', name: 'Damion', category: 'cursive', file: 'Damion-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/damion/Damion-Regular.ttf' },
  { id: 'KaushanScript', name: 'Kaushan Script', category: 'cursive', file: 'KaushanScript-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/kaushanscript/KaushanScript-Regular.ttf' },
  { id: 'PinyonScript', name: 'Pinyon Script', category: 'cursive', file: 'PinyonScript-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/pinyonscript/PinyonScript-Regular.ttf' },
  { id: 'Tangerine', name: 'Tangerine', category: 'cursive', file: 'Tangerine-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/tangerine/Tangerine-Bold.ttf' },
  { id: 'BadScript', name: 'Bad Script', category: 'cursive', file: 'BadScript-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/badscript/BadScript-Regular.ttf' },
  { id: 'CedarvilleCursive', name: 'Cedarville Cursive', category: 'cursive', file: 'CedarvilleCursive-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cedarvillecursive/Cedarville-Cursive.ttf' },

  // 💥 Comic, Cartoon & Action (16)
  { id: 'Bangers', name: 'Bangers', category: 'comic', file: 'Bangers-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bangers/Bangers-Regular.ttf' },
  { id: 'LuckiestGuy', name: 'Luckiest Guy', category: 'comic', file: 'LuckiestGuy-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/luckiestguy/LuckiestGuy-Regular.ttf' },
  { id: 'Fredoka', name: 'Fredoka', category: 'comic', file: 'Fredoka-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/Fredoka%5Bwdth%2Cwght%5D.ttf' },
  { id: 'Bungee', name: 'Bungee', category: 'comic', file: 'Bungee-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bungee/Bungee-Regular.ttf' },
  { id: 'BungeeShade', name: 'Bungee Shade', category: 'comic', file: 'BungeeShade-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bungeeshade/BungeeShade-Regular.ttf' },
  { id: 'Chewy', name: 'Chewy', category: 'comic', file: 'Chewy-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/chewy/Chewy-Regular.ttf' },
  { id: 'Righteous', name: 'Righteous', category: 'comic', file: 'Righteous-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/righteous/Righteous-Regular.ttf' },
  { id: 'Sniglet', name: 'Sniglet', category: 'comic', file: 'Sniglet-ExtraBold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sniglet/Sniglet-ExtraBold.ttf' },
  { id: 'CarterOne', name: 'Carter One', category: 'comic', file: 'CarterOne-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/carterone/CarterOne.ttf' },
  { id: 'Chango', name: 'Chango', category: 'comic', file: 'Chango-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/chango/Chango-Regular.ttf' },
  { id: 'Boogaloo', name: 'Boogaloo', category: 'comic', file: 'Boogaloo-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/boogaloo/Boogaloo-Regular.ttf' },
  { id: 'SpicyRice', name: 'Spicy Rice', category: 'comic', file: 'SpicyRice-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/spicyrice/SpicyRice-Regular.ttf' },
  { id: 'TitanOne', name: 'Titan One', category: 'comic', file: 'TitanOne-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/titanone/TitanOne-Regular.ttf' },
  { id: 'BowlbyOne', name: 'Bowlby One', category: 'comic', file: 'BowlbyOne-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bowlbyone/BowlbyOne-Regular.ttf' },
  { id: 'Ribeye', name: 'Ribeye', category: 'comic', file: 'Ribeye-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/ribeye/Ribeye-Regular.ttf' },
  { id: 'Shrikhand', name: 'Shrikhand', category: 'comic', file: 'Shrikhand-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/shrikhand/Shrikhand-Regular.ttf' },

  // 🚀 Sci-Fi & Cyber (12)
  { id: 'Orbitron', name: 'Orbitron', category: 'scifi', file: 'Orbitron-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/orbitron/Orbitron%5Bwght%5D.ttf' },
  { id: 'MajorMonoDisplay', name: 'Major Mono', category: 'scifi', file: 'MajorMonoDisplay-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/majormonodisplay/MajorMonoDisplay-Regular.ttf' },
  { id: 'SpaceMono', name: 'Space Mono', category: 'scifi', file: 'SpaceMono-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/spacemono/SpaceMono-Bold.ttf' },
  { id: 'Michroma', name: 'Michroma', category: 'scifi', file: 'Michroma-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/michroma/Michroma-Regular.ttf' },
  { id: 'Syncopate', name: 'Syncopate', category: 'scifi', file: 'Syncopate-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/syncopate/Syncopate-Regular.ttf' },
  { id: 'Electrolize', name: 'Electrolize', category: 'scifi', file: 'Electrolize-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/electrolize/Electrolize-Regular.ttf' },
  { id: 'BrunoAce', name: 'Bruno Ace', category: 'scifi', file: 'BrunoAce-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/brunoace/BrunoAce-Regular.ttf' },
  { id: 'RussoOne', name: 'Russo One', category: 'scifi', file: 'RussoOne-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/russoone/RussoOne-Regular.ttf' },
  { id: 'Aldrich', name: 'Aldrich', category: 'scifi', file: 'Aldrich-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/aldrich/Aldrich-Regular.ttf' },
  { id: 'SairaStencilOne', name: 'Saira Stencil', category: 'scifi', file: 'SairaStencilOne-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sairastencilone/SairaStencilOne-Regular.ttf' },
  { id: 'NovaMono', name: 'Nova Mono', category: 'scifi', file: 'NovaMono-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/novamono/NovaMono.ttf' },
  { id: 'Chathura', name: 'Chathura', category: 'scifi', file: 'Chathura-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/chathura/Chathura-Bold.ttf' },

  // 🎃 Spooky & Quirky Display (12)
  { id: 'Creepster', name: 'Creepster', category: 'spooky', file: 'Creepster-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/creepster/Creepster-Regular.ttf' },
  { id: 'Nosifer', name: 'Nosifer', category: 'spooky', file: 'Nosifer-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/nosifer/Nosifer-Regular.ttf' },
  { id: 'Eater', name: 'Eater', category: 'spooky', file: 'Eater-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/eater/Eater-Regular.ttf' },
  { id: 'Frijole', name: 'Frijole', category: 'spooky', file: 'Frijole-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/frijole/Frijole-Regular.ttf' },
  { id: 'Rye', name: 'Rye', category: 'spooky', file: 'Rye-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/rye/Rye-Regular.ttf' },
  { id: 'Monoton', name: 'Monoton', category: 'spooky', file: 'Monoton-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/monoton/Monoton-Regular.ttf' },
  { id: 'Butcherman', name: 'Butcherman', category: 'spooky', file: 'Butcherman-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/butcherman/Butcherman-Regular.ttf' },
  { id: 'Shojumaru', name: 'Shojumaru', category: 'spooky', file: 'Shojumaru-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/shojumaru/Shojumaru-Regular.ttf' },
  { id: 'Sancreek', name: 'Sancreek', category: 'spooky', file: 'Sancreek-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sancreek/Sancreek-Regular.ttf' },
  { id: 'TradeWinds', name: 'Trade Winds', category: 'spooky', file: 'TradeWinds-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/tradewinds/TradeWinds-Regular.ttf' },
  { id: 'MetalMania', name: 'Metal Mania', category: 'spooky', file: 'MetalMania-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/metalmania/MetalMania-Regular.ttf' },
  { id: 'Piedra', name: 'Piedra', category: 'spooky', file: 'Piedra-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/piedra/Piedra-Regular.ttf' },

  // ✨ Modern & Clean Display (10)
  { id: 'Poppins', name: 'Poppins', category: 'modern', file: 'Poppins-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf' },
  { id: 'Inter', name: 'Inter', category: 'modern', file: 'Inter-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf' },
  { id: 'Raleway', name: 'Raleway', category: 'modern', file: 'Raleway-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/Raleway%5Bwght%5D.ttf' },
  { id: 'Outfit', name: 'Outfit', category: 'modern', file: 'Outfit-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/Outfit%5Bwght%5D.ttf' },
  { id: 'Comfortaa', name: 'Comfortaa', category: 'modern', file: 'Comfortaa-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/comfortaa/Comfortaa%5Bwght%5D.ttf' },
  { id: 'Quicksand', name: 'Quicksand', category: 'modern', file: 'Quicksand-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/quicksand/Quicksand%5Bwght%5D.ttf' },
  { id: 'Syne', name: 'Syne', category: 'modern', file: 'Syne-ExtraBold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/syne/Syne%5Bwght%5D.ttf' },
  { id: 'Epilogue', name: 'Epilogue', category: 'modern', file: 'Epilogue-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/epilogue/Epilogue%5Bwght%5D.ttf' },
  { id: 'JosefinSans', name: 'Josefin Sans', category: 'modern', file: 'JosefinSans-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/josefinsans/JosefinSans%5Bwght%5D.ttf' },
  { id: 'Lexend', name: 'Lexend', category: 'modern', file: 'Lexend-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lexend/Lexend%5Bwght%5D.ttf' },
];

const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const CONSTANTS_DIR = path.join(__dirname, '..', 'src', 'constants');

if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

if (!fs.existsSync(CONSTANTS_DIR)) {
  fs.mkdirSync(CONSTANTS_DIR, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      return resolve(false); // already exists
    }

    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        fs.unlink(dest, () => {});
        return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(true));
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log(`Checking & downloading ${FONTS.length} curated Google Fonts to ${FONTS_DIR}...`);
  let downloadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < FONTS.length; i++) {
    const font = FONTS[i];
    const dest = path.join(FONTS_DIR, font.file);
    try {
      const downloaded = await downloadFile(font.url, dest);
      if (downloaded) {
        downloadedCount++;
        process.stdout.write(`[${i + 1}/${FONTS.length}] Downloaded ${font.name}\n`);
      } else {
        skippedCount++;
      }
    } catch (err) {
      errorCount++;
      console.error(`[${i + 1}/${FONTS.length}] Error downloading ${font.name}: ${err.message}`);
    }
  }

  console.log(`\nFinished: ${downloadedCount} downloaded, ${skippedCount} existing, ${errorCount} errors.`);

  // Filter only successfully downloaded fonts
  const validFonts = FONTS.filter((f) => {
    const p = path.join(FONTS_DIR, f.file);
    return fs.existsSync(p) && fs.statSync(p).size > 1000;
  });

  const fontDefinitions = validFonts.map((f) => {
    return `  {
    id: '${f.id}',
    name: '${f.name}',
    family: '${f.id}',
    category: '${f.category}',
    asset: require('../../assets/fonts/${f.file}'),
  }`;
  }).join(',\n');

  const tsContent = `// Auto-generated 100 Curated Offline Google Fonts Registry
import { FontCategory } from '../types/textOverlay';

export interface AppFont {
  id: string;
  name: string;
  family: string;
  category: FontCategory;
  asset: any;
}

export const FONT_CATEGORIES: { id: FontCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'pixel', label: 'Pixel & 8-Bit', icon: 'game-controller' },
  { id: 'cinematic', label: 'Cinematic', icon: 'film' },
  { id: 'cursive', label: 'Cursive', icon: 'brush' },
  { id: 'comic', label: 'Comic', icon: 'chatbubble-ellipses' },
  { id: 'scifi', label: 'Sci-Fi', icon: 'planet' },
  { id: 'spooky', label: 'Spooky', icon: 'skull' },
  { id: 'modern', label: 'Modern', icon: 'sparkles' },
];

export const APP_FONTS: AppFont[] = [
${fontDefinitions}
];

export const CORE_FONT_IDS = [
  'PressStart2P',
  'Cinzel',
  'BebasNeue',
  'GreatVibes',
  'Pacifico',
  'Bangers',
  'LuckiestGuy',
  'Orbitron',
  'Creepster',
  'Poppins',
];
`;

  const tsPath = path.join(CONSTANTS_DIR, 'fonts.ts');
  fs.writeFileSync(tsPath, tsContent, 'utf8');
  console.log(`Generated ${tsPath} with ${validFonts.length} verified offline fonts!`);
}

run();
