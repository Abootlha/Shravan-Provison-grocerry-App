import * as React from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Approximates one slide of the customer app's banner carousel (customer-app BannerCarousel):
 * 2:1, 12px radius, the image covering the slide. The app shows store banners as finished
 * artwork, so the headline is NOT drawn over the image (it is the screen-reader label and names
 * the banner here); the title only appears in this preview while there is no image yet.
 */
export function BannerPreview({
    title,
    titleHi,
    image,
    lang = 'en',
    size = 'md',
    className,
}: {
    title?: string;
    titleHi?: string;
    image?: string;
    lang?: 'en' | 'hi';
    size?: 'sm' | 'md';
    className?: string;
}) {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [image]);
    const text = lang === 'hi' ? titleHi || title : title;
    const showImage = !!image && /^https:\/\//i.test(image) && !failed;
    return (
        <div
            className={cn(
                '@container relative aspect-[2/1] w-full overflow-hidden bg-[#EDEDEA] dark:bg-[#232323]',
                size === 'sm' ? 'rounded-md' : 'rounded-xl',
                className,
            )}
        >
            {showImage ? (
                <img src={image} alt="" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
            ) : size === 'md' ? (
                <div className="absolute inset-y-0 right-0 flex w-1/2 flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <ImageOff className="size-5" aria-hidden />
                    <span className="text-xs">{image && failed ? 'Image did not load' : 'Add an image'}</span>
                </div>
            ) : null}
            {text && size === 'md' && !showImage ? (
                <div className="absolute inset-y-0 left-4 flex w-[calc(44%-1rem)] items-center sm:left-5">
                    <p
                        lang={lang === 'hi' && titleHi ? 'hi' : undefined}
                        className="line-clamp-3 text-[clamp(1rem,3.4cqi,1.5rem)] leading-tight font-bold text-balance text-[#151515] dark:text-[#F2F2F2]"
                    >
                        {text}
                    </p>
                </div>
            ) : null}
        </div>
    );
}
