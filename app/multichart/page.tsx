import { Suspense } from 'react';
import Spinner from '../components/ui/Spinner';
import { CommitLink } from '../components/CommitLink';
import { ThemeProvider } from '../components/ThemeContext';
import { ThemeWrapper } from '../components/ThemeWrapper';
import ClientPageWrapper from '../components/ClientPageWrapper';
import MultiChartContainer from '../components/MultiChartContainer';
import CustomChartsDropdown from '../components/stock-table/components/CustomChartsDropdown';

export default async function MultiChartPage() {
    return (
        <ThemeProvider>
            <ThemeWrapper>
                <ClientPageWrapper>
                    <div className="flex justify-end mb-2">
                        <CustomChartsDropdown />
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