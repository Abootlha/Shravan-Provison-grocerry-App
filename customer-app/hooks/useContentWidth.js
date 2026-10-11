import { useWindowDimensions } from 'react-native';
import { CONTENT_MAX_WIDTH } from '../constants/theme';

/**
 * Width of the content column: the window width on phones, capped at CONTENT_MAX_WIDTH (560) on
 * tablets / desktop web, where screens centre the column (see `contentColumn`). Use it instead of
 * useWindowDimensions() wherever a size is derived from the screen width inside that column.
 */
export function useContentWidth() {
    const { width } = useWindowDimensions();
    return Math.min(width, CONTENT_MAX_WIDTH);
}

/** Style for a screen's centred content column. */
export const contentColumn = { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' };

export default useContentWidth;
