import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale, getLocale } from '../src/shared/i18n';

describe('i18n', () => {
  beforeEach(() => {
    // Reset to default locale
    setLocale('zh');
  });

  describe('getLocale', () => {
    it('returns default locale zh', () => {
      expect(getLocale()).toBe('zh');
    });

    it('returns current locale after change', () => {
      setLocale('en');
      expect(getLocale()).toBe('en');
    });
  });

  describe('setLocale', () => {
    it('sets locale to en', () => {
      setLocale('en');
      expect(getLocale()).toBe('en');
    });

    it('sets locale to zh', () => {
      setLocale('en');
      setLocale('zh');
      expect(getLocale()).toBe('zh');
    });

    it('ignores invalid locale', () => {
      setLocale('fr');
      expect(getLocale()).toBe('zh');
    });

    it('ignores empty string locale', () => {
      setLocale('');
      expect(getLocale()).toBe('zh');
    });
  });

  describe('t() - Chinese locale', () => {
    it('returns Chinese strings by default', () => {
      expect(t().setDir).toBe('设置目录');
      expect(t().unset).toBe('取消设置');
      expect(t().edit).toBe('编辑');
      expect(t().create).toBe('创建');
      expect(t().delete).toBe('删除');
      expect(t().cancel).toBe('取消');
    });

    it('returns Chinese file-related strings', () => {
      expect(t().fileName).toBe('文件名');
      expect(t().sheetName).toBe('表名');
      expect(t().fileListTitle).toBe('数据目录文件');
    });

    it('returns Chinese function strings', () => {
      expect(t().fileCreated('test')).toContain('test');
      expect(t().fileCreated('test')).toContain('已创建');
    });

    it('returns Chinese error messages', () => {
      expect(t().dataDirNotSet).toBe('数据目录未设置');
      expect(t().noFileSelected).toBe('未选择文件');
      expect(t().invalidPath).toBe('无效的文件路径');
    });

    it('returns Chinese dialog strings', () => {
      expect(t().confirmDelete).toBe('确认删除');
      expect(t().confirmDeleteMessage('file.xlsx')).toContain('file.xlsx');
    });
  });

  describe('t() - English locale', () => {
    beforeEach(() => {
      setLocale('en');
    });

    it('returns English strings', () => {
      expect(t().setDir).toBe('Set Dir');
      expect(t().unset).toBe('Unset');
      expect(t().edit).toBe('Edit');
      expect(t().create).toBe('Create');
      expect(t().delete).toBe('Delete');
      expect(t().cancel).toBe('Cancel');
    });

    it('returns English file-related strings', () => {
      expect(t().fileName).toBe('File Name');
      expect(t().sheetName).toBe('Sheet Name');
      expect(t().fileListTitle).toBe('Data Directory Files');
    });

    it('returns English function strings', () => {
      expect(t().fileCreated('test')).toContain('test');
      expect(t().fileCreated('test')).toContain('created');
    });

    it('returns English error messages', () => {
      expect(t().dataDirNotSet).toBe('Data directory not set');
      expect(t().noFileSelected).toBe('No file selected');
      expect(t().invalidPath).toBe('Invalid file path');
    });

    it('returns English dialog strings', () => {
      expect(t().confirmDelete).toBe('Confirm Delete');
      expect(t().confirmDeleteMessage('file.xlsx')).toContain('file.xlsx');
    });
  });

  describe('t() - message template functions', () => {
    it('fileCreated includes filename', () => {
      const msg = t().fileCreated('monster_data');
      expect(msg).toContain('monster_data');
    });

    it('confirmDeleteMessage includes filename', () => {
      const msg = t().confirmDeleteMessage('task/task.xlsx');
      expect(msg).toContain('task/task.xlsx');
    });

    it('deletedMessage includes filename', () => {
      const msg = t().deletedMessage('old_data');
      expect(msg).toContain('old_data');
    });

    it('unexpectedErrorMessage includes error', () => {
      const msg = t().unexpectedErrorMessage('something failed');
      expect(msg).toContain('something failed');
    });

    it('pathNotExist includes path', () => {
      const msg = t().pathNotExist('/some/path');
      expect(msg).toContain('/some/path');
    });

    it('noXlsxInDir includes directory', () => {
      const msg = t().noXlsxInDir('mydir');
      expect(msg).toContain('mydir');
    });

    it('invalidSheetNameMessage includes name', () => {
      const msg = t().invalidSheetNameMessage('BAD_NAME');
      expect(msg).toContain('BAD_NAME');
    });

    it('tmpFileCreateFailed includes error', () => {
      const msg = t().tmpFileCreateFailed('ENOENT');
      expect(msg).toContain('ENOENT');
    });
  });
});
