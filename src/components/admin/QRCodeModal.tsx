import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

interface QRCodeModalProps {
  showQRModal: boolean;
  onClose: () => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({
  showQRModal,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {showQRModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
            }}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white text-xl sm:text-2xl font-bold">
                Quiz QR Code
              </h3>
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-white transition-colors text-2xl leading-none"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="bg-white p-4 rounded-xl shadow-lg">
                <QRCodeSVG
                  value={`${window.location.origin}/quiz`}
                  size={200}
                  level="M"
                />
              </div>

              <div className="text-center">
                <p className="text-neutral-300 text-sm mb-2">
                  Scan to join the quiz
                </p>
                <p className="text-neutral-400 text-xs break-all">
                  {`${window.location.origin}/quiz`}
                </p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/quiz`,
                  );
                  toast.success("URL copied to clipboard!", {
                    icon: "📋",
                  });
                }}
                className="w-full bg-purple-500/30 border border-purple-400/30 hover:bg-purple-500/40 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200"
              >
                Copy URL
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QRCodeModal;
