import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { AppText, Banner, Button } from './ui';
import { font, radii, spacing, TOUCH_TARGET, useTheme } from '../theme';
import { REJECT_REASONS } from '../utils/constants';

type Props = {
  visible: boolean;
  orderNumber: string;
  /** decline: an offer; release: an accepted order the store has not packed yet. */
  mode: 'decline' | 'release';
  onClose: () => void;
  /** Resolve to an error message to keep the sheet open, or null when done. */
  onSubmit: (reason: string) => Promise<string | null>;
};

const OTHER = 'Other';

export const RejectSheet: React.FC<Props> = ({ visible, orderNumber, mode, onClose, onSubmit }) => {
  const { colors: c } = useTheme();
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setChoice(null);
      setOther('');
      setError(null);
    }
  }, [visible]);

  const reason = choice === OTHER ? other.trim() : choice;
  const canSubmit = Boolean(reason) && !busy;

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit(reason);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={!busy}
      title={mode === 'decline' ? 'Decline this order?' : 'Release this order?'}
      subtitle={
        mode === 'decline'
          ? `${orderNumber} will be offered to another rider.`
          : `${orderNumber} goes back to the store and is offered to another rider. This lowers your acceptance rate.`
      }
    >
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        {[...REJECT_REASONS, OTHER].map((item) => {
          const selected = choice === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setChoice(item)}
              style={({ pressed }) => ({
                minHeight: TOUCH_TARGET,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                borderRadius: radii.md,
                borderWidth: 1.5,
                borderColor: selected ? c.brand : c.border,
                backgroundColor: selected ? c.brandSoft : pressed ? c.surfaceAlt : c.surface,
              })}
            >
              <MaterialCommunityIcons
                name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={selected ? c.brand : c.textSubtle}
              />
              <AppText variant="body" weight={selected ? 'semibold' : 'regular'}>
                {item}
              </AppText>
            </Pressable>
          );
        })}
        {choice === OTHER ? (
          <TextInput
            value={other}
            onChangeText={setOther}
            placeholder="Tell the store why"
            placeholderTextColor={c.textSubtle}
            maxLength={300}
            autoFocus
            style={[
              font('regular'),
              {
                minHeight: TOUCH_TARGET,
                borderRadius: radii.md,
                borderWidth: 1.5,
                borderColor: c.borderStrong,
                paddingHorizontal: spacing.lg,
                color: c.text,
                fontSize: 16,
                backgroundColor: c.surface,
              },
            ]}
          />
        ) : null}
      </View>
      {error ? <Banner tone="danger" title={error} style={{ marginTop: spacing.md }} /> : null}
      <Button
        label={mode === 'decline' ? 'Decline order' : 'Release order'}
        variant="danger"
        onPress={submit}
        disabled={!canSubmit}
        loading={busy}
        style={{ marginTop: spacing.lg }}
      />
    </Sheet>
  );
};
