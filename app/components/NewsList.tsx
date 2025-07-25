'use client'

import Image from 'next/image'
import { useState } from 'react'
import ExpandableDescription from './ExpandableDescription'
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

export default function NewsList({ news }: { news: NewsItem[] }) {
  if (!Array.isArray(news)) return null
  const sortedNews = [...news].sort((a, b) =>
    new Date(b.published_utc ?? 0).getTime() - new Date(a.published_utc ?? 0).getTime()
  )
  const topThree = sortedNews.slice(0, 3)
  return (
    <div className="mt-4 space-y-4">
      {topThree.map((item) => (
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
                {item.published_utc && (
                    <p className="text-gray-400 text-sm">{item.published_utc}</p>
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