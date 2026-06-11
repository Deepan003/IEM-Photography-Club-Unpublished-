/** Curated list of popular cameras and lenses for autocomplete */

export const CAMERAS = [
  // Canon
  'Canon EOS R5','Canon EOS R6 Mark II','Canon EOS R3','Canon EOS R7','Canon EOS R8','Canon EOS R10',
  'Canon EOS R50','Canon EOS R100','Canon EOS 90D','Canon EOS 5D Mark IV','Canon EOS 6D Mark II',
  'Canon EOS 250D','Canon EOS 850D','Canon EOS M50 Mark II','Canon PowerShot G7 X Mark III',
  // Nikon
  'Nikon Z9','Nikon Z8','Nikon Z7 II','Nikon Z6 III','Nikon Z6 II','Nikon Z5 II','Nikon Zf',
  'Nikon Zfc','Nikon Z50','Nikon Z30','Nikon D850','Nikon D780','Nikon D7500','Nikon D5600',
  'Nikon D3500','Nikon D3400','Nikon COOLPIX P1000',
  // Sony
  'Sony A1','Sony A9 III','Sony A7R V','Sony A7 IV','Sony A7C II','Sony A7S III','Sony A6700',
  'Sony A6400','Sony A6100','Sony ZV-E10 II','Sony ZV-E10','Sony ZV-1 II','Sony FX3','Sony FX30',
  'Sony RX100 VII','Sony RX10 IV',
  // Fujifilm
  'Fujifilm X-T5','Fujifilm X-T4','Fujifilm X-H2S','Fujifilm X-H2','Fujifilm X-S20','Fujifilm X-S10',
  'Fujifilm X-T30 II','Fujifilm X-E4','Fujifilm X100VI','Fujifilm X100V','Fujifilm GFX 100S',
  'Fujifilm GFX 50S II','Fujifilm X-T200','Fujifilm Instax',
  // Panasonic
  'Panasonic S5 II','Panasonic S5 IIX','Panasonic S5','Panasonic S1R','Panasonic G9 II',
  'Panasonic GH6','Panasonic GH5 II','Panasonic GH5','Panasonic G100','Panasonic G7',
  // OM System / Olympus
  'OM System OM-1 Mark II','OM System OM-1','OM System OM-5','Olympus E-M1 Mark III',
  'Olympus E-M10 Mark IV','Olympus TG-7',
  // Leica
  'Leica Q3','Leica Q2','Leica M11','Leica SL3','Leica SL2','Leica CL',
  // Hasselblad
  'Hasselblad X2D 100C','Hasselblad 907X','Hasselblad H6D-100c',
  // DJI
  'DJI Osmo Pocket 3','DJI Action 4','DJI Mini 4 Pro (drone)',
  // GoPro
  'GoPro Hero 12 Black','GoPro Hero 11 Black',
  // Phone cameras
  'iPhone 15 Pro Max','iPhone 15 Pro','Samsung Galaxy S24 Ultra','Google Pixel 8 Pro',
]

export const LENSES = [
  // Canon RF
  'Canon RF 50mm f/1.2L','Canon RF 85mm f/1.2L','Canon RF 24-70mm f/2.8L',
  'Canon RF 70-200mm f/2.8L','Canon RF 100mm f/2.8L Macro','Canon RF 15-35mm f/2.8L',
  'Canon RF 28-70mm f/2L','Canon RF 35mm f/1.8','Canon RF 50mm f/1.8',
  // Canon EF
  'Canon EF 50mm f/1.4','Canon EF 50mm f/1.8 STM','Canon EF 85mm f/1.8',
  'Canon EF 24-105mm f/4L','Canon EF 70-200mm f/2.8L','Canon EF 100mm f/2.8L Macro',
  // Nikon Z
  'Nikon Z 50mm f/1.8 S','Nikon Z 85mm f/1.8 S','Nikon Z 24-70mm f/2.8 S',
  'Nikon Z 70-200mm f/2.8 S','Nikon Z 24-120mm f/4 S','Nikon Z 14-30mm f/4 S',
  // Sony FE
  'Sony FE 50mm f/1.2 GM','Sony FE 85mm f/1.4 GM','Sony FE 24-70mm f/2.8 GM II',
  'Sony FE 70-200mm f/2.8 GM II','Sony FE 135mm f/1.8 GM','Sony FE 16-35mm f/2.8 GM',
  'Sony FE 100-400mm f/4.5-5.6 GM','Sony FE 90mm f/2.8 Macro',
  // Sigma (popular Art series)
  'Sigma 35mm f/1.4 Art','Sigma 50mm f/1.4 Art','Sigma 85mm f/1.4 Art',
  'Sigma 24-70mm f/2.8 Art','Sigma 18-35mm f/1.8 Art','Sigma 100-400mm Contemporary',
  // Tamron
  'Tamron 17-28mm f/2.8 Di III','Tamron 28-75mm f/2.8 G2','Tamron 70-180mm f/2.8',
  'Tamron 150-500mm f/5-6.7',
  // Fujifilm XF
  'Fujifilm XF 23mm f/1.4 R LM WR','Fujifilm XF 35mm f/1.4 R','Fujifilm XF 56mm f/1.2 R WR',
  'Fujifilm XF 18-55mm f/2.8-4','Fujifilm XF 16-80mm f/4',
  // Generic
  '18-55mm Kit Lens','55-250mm Telephoto','70-300mm Telephoto',
]

export const DEVICE_TYPES = ['camera', 'lens', 'other']

/** Filter cameras by typed query */
export function searchCameras(query) {
  if (!query || query.length < 2) return []
  const q = query.toLowerCase()
  return CAMERAS.filter(c => c.toLowerCase().includes(q)).slice(0, 8)
}

/** Filter lenses by typed query */
export function searchLenses(query) {
  if (!query || query.length < 2) return []
  const q = query.toLowerCase()
  return LENSES.filter(l => l.toLowerCase().includes(q)).slice(0, 8)
}
