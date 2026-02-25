'use client'

import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

type SessionRenameDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionTitle: string
  onSave: (newTitle: string) => void
  onCancel: () => void
}

export function SessionRenameDialog({
  open,
  onOpenChange,
  sessionTitle,
  onSave,
  onCancel,
}: SessionRenameDialogProps) {
  const { t } = useTranslation()
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="p-4">
          <DialogTitle className="mb-1">{t('sidebar.rename')}</DialogTitle>
          <DialogDescription className="mb-4">
            {t('sidebar.renameSessionDescription')}
          </DialogDescription>
          <input
            type="text"
            defaultValue={sessionTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSave(e.currentTarget.value)
              }
            }}
            className="w-full rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none focus:border-primary-400"
            placeholder={t('sidebar.sessionNamePlaceholder')}
            autoFocus
          />
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose onClick={onCancel}>{t('common.cancel')}</DialogClose>
            <Button
              onClick={(e) => {
                const input = e.currentTarget.parentElement
                  ?.previousElementSibling as HTMLInputElement
                onSave(input.value)
              }}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
