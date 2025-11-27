import { useState } from 'react';
import { Info } from 'lucide-react';

interface Props {
    content: string;
}

export function InfoTooltip({ content }: Props) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className="relative inline-flex items-center ml-2">
            <Info
                className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={() => setIsVisible(!isVisible)}
            />
            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-50 w-max max-w-[200px] whitespace-normal">
                    {content}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover" />
                </div>
            )}
        </div>
    );
}
