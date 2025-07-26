'use client'

import SafeImage from './SafeImage'

export type NewsItem = {
  amp_url: string
  article_url: string
  author: string
  description: string
  id: string
  image_url: string
  insights?: unknown
  keywords?: string[]
  published_utc?: string
  publisher?: {
    favicon_url?: string
    homepage_url?: string
    logo_url?: string
    name: string
  }
  tickers: string[]
  title: string
}

interface NewsListProps {
  news: NewsItem[];
  compact?: boolean;
}

export default function NewsList({ news, compact = false }: NewsListProps) {
  if (!Array.isArray(news)) return null
  const sortedNews = [...news].sort((a, b) =>
    new Date(b.published_utc ?? 0).getTime() - new Date(a.published_utc ?? 0).getTime()
  )
  const topNews = compact ? sortedNews.slice(0, 2) : sortedNews.slice(0, 3)
  
  if (compact) {
    return (
      <div className="space-y-2">
        {topNews.map((item) => (
          <div
            key={item.id}
            className="bg-gray-800 rounded-lg p-2 border border-gray-600 hover:border-gray-500 transition-colors"
          >
            {/* Publisher and Date */}
            {item.publisher?.name && (
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center">
                  {item.publisher.favicon_url && (
                    <SafeImage
                      src={item.publisher.favicon_url}
                      alt={item.publisher.name}
                      width={12}
                      height={12}
                      className="mr-1"
                    />
                  )}
                  <span className="text-xs text-gray-400 truncate">
                    {item.publisher.name}
                  </span>
                </div>
                {typeof item.published_utc === 'string' && (
                  <span className="text-xs text-gray-500">
                    {item.published_utc.slice(5, 10)}
                  </span>
                )}
              </div>
            )}

            {/* Title */}
            <a
              href={item.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-300 text-sm font-medium hover:underline line-clamp-2 block"
            >
              {item.title}
            </a>

            {/* Compact Keywords */}
            {(item.keywords ?? []).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {(item.keywords ?? []).slice(0, 2).map((kw) => (
                  <span
                    key={kw}
                    className="text-xs bg-teal-800 text-teal-200 rounded px-1 py-0.5"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Original layout for non-compact view
  return (
    <div className="mt-4 space-y-4">
      {topNews.map((item) => (
        <div
          key={item.id}
          className="flex flex-col sm:flex-row bg-[#111827] rounded-xl p-4 shadow-md border border-[#1f2937] hover:border-[#374151] transition"
        >
          {/* Thumbnail */}
          <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
            {item.image_url && (
              <SafeImage
                src={item.image_url}
                alt={item.title}
                width={160}
                height={90}
                className="rounded-lg object-cover"
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1">
            {/* Publisher */}
            {item.publisher?.name && (
              <div className="flex items-center mb-1">
                {item.publisher.favicon_url && (
                  <SafeImage
                    src={item.publisher.favicon_url}
                    alt={item.publisher.name}
                    width={16}
                    height={16}
                    className="mr-2"
                  />
                )}
                <a
                  href={item.publisher.homepage_url || '#'}
                  className="text-sm text-gray-400 hover:text-white"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.publisher.name}
                </a>
                {typeof item.published_utc === 'string' && (
                  <p className="text-gray-400 text-sm">
                    {item.published_utc.slice(0, 10)}
                  </p>
                )}
              </div>
            )}

            {/* Title */}
            <a
              href={item.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 text-lg font-semibold hover:underline"
            >
              {item.title}
            </a>

            {/* Tags */}
            <div className="mt-2 flex flex-wrap gap-2">
              {(item.keywords ?? []).map((kw) => (
                <span
                  key={kw}
                  className="text-xs bg-teal-700 text-white rounded-full px-2 py-0.5"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}