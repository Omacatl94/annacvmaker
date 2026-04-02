import { useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';
import Icon from './Icon';

export default function UploadZone({ onParsed }) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { text, type: 'success'|'error' }
  const [dragover, setDragover] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = useCallback(async (file) => {
    try {
      setLoading(true);
      setFeedback(null);

      // Step 1: Upload
      const uploadResult = await api.uploadCV(file);

      // Step 2: Parse with OCR + structuring
      const parseResult = await api.parseCV(uploadResult.path);

      // Step 3: Feedback + callback
      setFeedback({ text: t('upload.success'), type: 'success' });
      if (onParsed) onParsed(parseResult.structured);
    } catch (err) {
      setFeedback({
        text: t('common.errorPrefix') + (err.message || 'Failed to parse CV'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [onParsed]);

  const handleClick = useCallback((e) => {
    if (e.target === fileInputRef.current) return;
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e) => {
    if (e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragover(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragover(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragover(false);
    if (e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  return (
    <div
      className={`upload-zone${dragover ? ' dragover' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {loading ? (
        <div className="upload-loading" style={{ display: 'flex' }}>
          <div className="upload-spinner" />
          <p>{t('upload.loading')}</p>
        </div>
      ) : (
        <>
          <div className="upload-icon">
            <Icon name="file-up" size={36} />
          </div>
          <p className="upload-text">{t('upload.dropText')}</p>
          <p className="upload-subtext">{t('upload.subtext')}</p>
        </>
      )}

      {feedback && (
        <div className={`upload-feedback ${feedback.type}`} style={{ display: 'block' }}>
          {feedback.text}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
