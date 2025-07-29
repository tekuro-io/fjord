import { Suspense } from 'react';
import Image from 'next/image';
import Spinner from '../components/ui/Spinner';
import { CommitLink } from '../components/CommitLink';
import { ThemeProvider } from '../components/ThemeContext';
import { ThemeWrapper } from '../components/ThemeWrapper';
import ClientPageWrapper from '../components/ClientPageWrapper';
import MultiChartContainer from '../components/MultiChartContainer';
import { CustomChartsDropdown } from '../components/stock-table/components';

export default async function MultiChartPage() {
    return (
        <ThemeProvider>
            <ThemeWrapper>
                <ClientPageWrapper>
                    <div className="text-center mb-2">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4 flex-1 justify-center">
                                <Image
                                    src="/stock.svg"          
                                    width={48}
                                    height={36}
                                    alt="Stock Screener Icon"
                                    className='inline-block'
                                />
                                <h1 className="text-2xl font-bold text-emerald-400">Multi-Chart</h1>
                            </div>
                            <div className="flex items-center gap-3">
                                <CustomChartsDropdown />
                            </div>
                        </div>
                    </div>

                    <Suspense fallback={<Spinner />}>
                        <MultiChartContainer />
                    </Suspense>
                    <footer className="w-full pt-2 py-1 text-center text-xs text-gray-400 font-sans tracking-wide mt-2">
                        <CommitLink />
                    </footer>
                </ClientPageWrapper>
            </ThemeWrapper>
        </ThemeProvider>
    );
}