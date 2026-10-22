import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Button from './Button';
import IconButton from './IconButton';
import { colors, radius, spacing, typography } from '../theme/theme';
import { PICKER_SUPPORTED, normalizeLink, pickImages, pickVideo } from '../utils/media';
import { useSheetInsets } from '../utils/insets';

// Bottom sheet for adding media: choose from the device library (expo-image-picker) or paste a link.
// kind: 'image' | 'video'.  avatar: square-cropped profile photo.  cover: crop to a cover.  multiple: several images at once.
// onPicked receives [{ uri, name }].
export default function MediaSheet({ visible, kind = 'image', cover = false, avatar = false, multiple = false, onClose, onPicked }) {
  const sheetInsets = useSheetInsets();
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setLink('');
      setMessage('');
      setBusy(false);
    }
  }, [visible]);

  const isVideo = kind === 'video';
  const noun = isVideo ? 'video' : avatar ? 'profile photo' : cover ? 'cover image' : multiple ? 'images' : 'image';

  const choose = async () => {
    setBusy(true);
    setMessage('');
    const result = isVideo ? await pickVideo() : await pickImages({ multiple, cover, avatar });
    setBusy(false);
    if (result.status === 'picked') {
      onPicked(result.items);
      onClose();
    } else if (result.message) {
      setMessage(result.message);
    }
  };

  const useLink = () => {
    const result = normalizeLink(link);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    onPicked([{ uri: result.uri, name: result.uri }]);
    onClose();
  };

  return (
    <Modal transparent visible={Boolean(visible)} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable style={[styles.backdrop, sheetInsets]} onPress={onClose} accessibilityLabel="Dismiss">
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>Add {noun}</Text>
              <IconButton name="close" label="Close" onPress={onClose} />
            </View>

            <Button
              title={isVideo ? 'Choose a video from your library' : 'Choose from your library'}
              icon={isVideo ? 'videocam-outline' : 'images-outline'}
              fullWidth
              loading={busy}
              disabled={!PICKER_SUPPORTED}
              onPress={choose}
            />
            {!PICKER_SUPPORTED ? (
              <Text style={styles.note}>The library picker isn&apos;t available in this runtime. Paste a link instead.</Text>
            ) : null}

            <Text style={styles.or}>OR PASTE A LINK</Text>
            <TextInput
              value={link}
              onChangeText={(t) => {
                setLink(t);
                setMessage('');
              }}
              placeholder={isVideo ? 'https://example.com/clip.mp4' : 'https://example.com/picture.jpg'}
              placeholderTextColor={colors.indigo300}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={useLink}
              accessibilityLabel={`${isVideo ? 'Video' : 'Image'} link`}
              style={styles.input}
            />
            <Button title="Use this link" variant="secondary" fullWidth onPress={useLink} style={styles.linkButton} />

            {message ? <Text style={styles.error}>{message}</Text> : null}
            <Text style={styles.note}>
              Files picked from your device are stored by reference, so they only show on this device.
              {isVideo ? ' Links should point straight to a video file (for example .mp4).' : ''}
            </Text>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(18, 15, 46, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.cream100,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  or: { ...typography.micro, color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.lg },
  input: {
    ...typography.body,
    backgroundColor: colors.cream50,
    borderWidth: 1,
    borderColor: colors.cream300,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
  },
  linkButton: { marginTop: spacing.md },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.md },
  note: { ...typography.caption, fontSize: 12, color: colors.textSecondary, marginTop: spacing.md },
});
