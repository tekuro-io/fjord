import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Spinner from '../components/ui/Spinner';
import { CommitLink } from '../components/CommitLink';
import { ThemeProvider } from '../components/ThemeContext';
import { ThemeWrapper } from '../components/ThemeWrapper';
import ClientPageWrapper from '../components/ClientPageWrapper';
import MultiChartContainer from '../components/MultiChartContainer';

export default async function MultiChartPage() {
    return (
        <ThemeProvider>
            <ThemeWrapper>
                <ClientPageWrapper>
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-emerald-400">
                            <Image
                                src="/stock.svg"          
                                width={120}
                                height={90}
                                alt="Stock Screener Icon"
                                className='inline-block mr-3 my-2'
                            />
                        </h1>
                        <div className="mt-4 flex justify-center gap-4">
                            <Link 
                                href="/" 
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
                            >
                                ← Back to Table View
                            </Link>
                        </div>
                    </div>

                    <Suspense fallback={<Spinner />}>
                        <MultiChartContainer />
                    </Suspense>
                    <footer className="w-full pt-8 py-3 text-center text-sm text-gray-400 font-sans tracking-wide mt-8">
                        <CommitLink />
                    </footer>
                </ClientPageWrapper>
            </ThemeWrapper>
        </ThemeProvider>
    );
}