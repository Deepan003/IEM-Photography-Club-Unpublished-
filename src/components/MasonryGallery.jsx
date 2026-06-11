import { useState } from 'react'

const items = [
  { id: '1', img: 'https://picsum.photos/id/1015/600/900?grayscale', label: 'Portrait Shoot'  },
  { id: '2', img: 'https://picsum.photos/id/1011/600/750?grayscale', label: 'Landscape'       },
  { id: '3', img: 'https://picsum.photos/id/1020/600/800?grayscale', label: 'Event Coverage'  },
  { id: '4', img: 'https://picsum.photos/id/1025/600/400?grayscale', label: 'Campus Life'     },
  { id: '5', img: 'https://picsum.photos/id/1027/600/800?grayscale', label: 'Workshop'        },
  { id: '6', img: 'https://picsum.photos/id/1035/600/500?grayscale', label: 'Creative'        },
  { id: '7', img: 'https://picsum.photos/id/1040/600/900?grayscale', label: 'Architecture'    },
]

export default function MasonryGallery() {
  const [hovered, setHovered] = useState(null)

  return (
    <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
      {items.map(item => (
        <div
          key={item.id}
          className="break-inside-avoid relative mb-4 overflow-hidden rounded-lg cursor-pointer transition-all duration-500 group"
          onMouseEnter={() => setHovered(item.id)}
          onMouseLeave={() => setHovered(null)}
          style={{
            filter:    hovered && hovered !== item.id ? 'blur(2px) opacity(0.7)' : 'none',
            transform: hovered === item.id ? 'scale(0.98)' : 'scale(1)',
          }}
        >
          <img src={item.img} alt={item.label} className="w-full h-auto object-cover rounded-lg" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="text-white font-tech text-xl tracking-widest uppercase">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
